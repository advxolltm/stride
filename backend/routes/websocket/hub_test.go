package websocket

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func numSubsForChannel(t *testing.T, channel string) int64 {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	res, err := rdb.PubSubNumSub(ctx, channel).Result()
	require.NoError(t, err)
	return res[channel]
}

func waitForSubCount(t *testing.T, channel string, want int64) {
	t.Helper()
	require.Eventually(t, func() bool {
		return numSubsForChannel(t, channel) == want
	}, 2*time.Second, 20*time.Millisecond, "expected %d redis subscribers on %s", want, channel)
}

func TestProjectHubRegistry_BroadcastDeliversToAllSubscribers(t *testing.T) {
	registry := NewProjectHubRegistry(rdb)
	projectID := uuid.New()
	channel := projectID.String()
	ctx := context.Background()

	subA, err := registry.Attach(ctx, projectID)
	require.NoError(t, err)
	defer subA.Detach()
	subB, err := registry.Attach(ctx, projectID)
	require.NoError(t, err)
	defer subB.Detach()

	waitForSubCount(t, channel, 1)

	payload := []byte("hello-hub")
	require.NoError(t, rdb.Publish(ctx, channel, payload).Err())

	for _, m := range []<-chan HubMessage{subA.Messages, subB.Messages} {
		select {
		case got, ok := <-m:
			require.True(t, ok)
			assert.Equal(t, payload, got.Payload)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout waiting for hub broadcast")
		}
	}
}

func TestProjectHubRegistry_AttachHandshakeNoMissedEvents(t *testing.T) {
	registry := NewProjectHubRegistry(rdb)
	projectID := uuid.New()
	channel := projectID.String()
	ctx := context.Background()

	sub, err := registry.Attach(ctx, projectID)
	require.NoError(t, err)
	defer sub.Detach()

	// Subscribe handshake is guaranteed by Attach; publish should arrive.
	waitForSubCount(t, channel, 1)
	require.NoError(t, rdb.Publish(ctx, channel, []byte("first")).Err())

	select {
	case got := <-sub.Messages:
		assert.Equal(t, []byte("first"), got.Payload)
	case <-time.After(2 * time.Second):
		t.Fatal("missed first event after attach")
	}
}

func TestProjectHubRegistry_SlowSubscriberEvicted(t *testing.T) {
	registry := NewProjectHubRegistry(rdb)
	projectID := uuid.New()
	channel := projectID.String()
	ctx := context.Background()

	slow, err := registry.Attach(ctx, projectID)
	require.NoError(t, err)
	fast, err := registry.Attach(ctx, projectID)
	require.NoError(t, err)
	defer fast.Detach()

	waitForSubCount(t, channel, 1)

	registry.mu.Lock()
	hub := registry.hubs[projectID]
	registry.mu.Unlock()
	require.NotNil(t, hub)

	// Drain fast continuously; never drain slow so its buffer fills and the
	// hub's deliver hits the 5s grace timeout.
	fastDone := make(chan struct{})
	go func() {
		defer close(fastDone)
		for range fast.Messages {
		}
	}()

	// Publish enough to overflow the slow buffer.
	for i := 0; i < hubSendBufferSize*2; i++ {
		require.NoError(t, rdb.Publish(ctx, channel, []byte(fmt.Sprintf("p-%d", i))).Err())
	}

	// Hub must drop the slow subscriber within grace + slack.
	require.Eventually(t, func() bool {
		hub.mu.RLock()
		defer hub.mu.RUnlock()
		return len(hub.subs) == 1
	}, hubSlowClientGrace+5*time.Second, 100*time.Millisecond, "slow subscriber must be evicted")

	// After eviction slow.Messages must eventually close (drain returns).
	slowDone := make(chan struct{})
	go func() {
		defer close(slowDone)
		for range slow.Messages {
		}
	}()
	select {
	case <-slowDone:
	case <-time.After(2 * time.Second):
		t.Fatal("slow.Messages must be closed after eviction")
	}

	// fast subscriber must still be alive.
	select {
	case <-fastDone:
		t.Fatal("fast subscriber must not be closed")
	default:
	}
}

// TestProjectHubRegistry_ReattachAfterTeardown_FreshSubscription verifies the
// recycle path: when the last subscriber detaches the hub tears down its
// redis subscription, and a subsequent Attach must transparently bring up a
// fresh subscription delivering new events. Without this, a project would
// appear "dead" forever after its room briefly empties.
func TestProjectHubRegistry_ReattachAfterTeardown_FreshSubscription(t *testing.T) {
	registry := NewProjectHubRegistry(rdb)
	projectID := uuid.New()
	channel := projectID.String()
	ctx := context.Background()

	first, err := registry.Attach(ctx, projectID)
	require.NoError(t, err)
	waitForSubCount(t, channel, 1)
	first.Detach()
	waitForSubCount(t, channel, 0)

	// Reattach: must create a new hub + new redis subscription.
	second, err := registry.Attach(ctx, projectID)
	require.NoError(t, err)
	defer second.Detach()
	waitForSubCount(t, channel, 1)

	require.NoError(t, rdb.Publish(ctx, channel, []byte("after-recycle")).Err())
	select {
	case got := <-second.Messages:
		assert.Equal(t, []byte("after-recycle"), got.Payload)
	case <-time.After(2 * time.Second):
		t.Fatal("re-attached subscriber must receive events")
	}
}

// TestProjectHubRegistry_DetachIsIdempotent guards against double-decrement of
// the refcount on accidental double-detach (e.g. websocket handler also
// calling Detach in defer after error). A second Detach must not panic, not
// close a non-empty hub, and not change subscriber count.
func TestProjectHubRegistry_DetachIsIdempotent(t *testing.T) {
	registry := NewProjectHubRegistry(rdb)
	projectID := uuid.New()
	channel := projectID.String()
	ctx := context.Background()

	other, err := registry.Attach(ctx, projectID)
	require.NoError(t, err)
	defer other.Detach()
	victim, err := registry.Attach(ctx, projectID)
	require.NoError(t, err)
	waitForSubCount(t, channel, 1)

	registry.mu.Lock()
	hub := registry.hubs[projectID]
	registry.mu.Unlock()
	require.NotNil(t, hub)

	victim.Detach()
	assert.NotPanics(t, func() { victim.Detach() }, "second Detach must be a no-op")

	hub.mu.RLock()
	subCount := len(hub.subs)
	hub.mu.RUnlock()
	assert.Equal(t, 1, subCount, "the other subscriber must still be attached after double-detach")

	// Hub still alive, events still flow to remaining subscriber.
	require.NoError(t, rdb.Publish(ctx, channel, []byte("alive")).Err())
	select {
	case got := <-other.Messages:
		assert.Equal(t, []byte("alive"), got.Payload)
	case <-time.After(2 * time.Second):
		t.Fatal("hub must remain alive after double-detach of one subscriber")
	}
}
