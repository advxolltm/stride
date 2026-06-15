package websocket

import (
	whiteboardSvc "backend/services/whiteboard"
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func cursorTestUser(id, name string) whiteboardSvc.CursorUser {
	return whiteboardSvc.CursorUser{ID: id, Name: name}
}

func cursorFloatPtr(value float64) *float64 {
	return &value
}

func waitForCursorHubSnapshot(
	t *testing.T,
	snapshots <-chan []byte,
	timeout time.Duration,
	predicate func([]whiteboardSvc.CursorPresence) bool,
) []whiteboardSvc.CursorPresence {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			t.Fatal("timeout waiting for cursor hub snapshot")
		}

		select {
		case payload, ok := <-snapshots:
			require.True(t, ok, "snapshot channel closed before expected snapshot")
			var snapshot []whiteboardSvc.CursorPresence
			require.NoError(t, json.Unmarshal(payload, &snapshot))
			if predicate(snapshot) {
				return snapshot
			}
		case <-time.After(remaining):
			t.Fatal("timeout waiting for cursor hub snapshot")
		}
	}
}

func requireCursorSnapshotChannelClosed(t *testing.T, snapshots <-chan []byte) {
	t.Helper()
	timeout := time.After(2 * time.Second)
	for {
		select {
		case _, ok := <-snapshots:
			if !ok {
				return
			}
		case <-timeout:
			t.Fatal("cursor snapshot channel did not close")
		}
	}
}

func TestCursorHubRegistry_AttachSendsInitialSnapshot(t *testing.T) {
	registry := NewCursorHubRegistry()
	projectID := uuid.New()
	user := cursorTestUser("user-a", "User A")

	sub, err := registry.AttachCursor(context.Background(), projectID, user)
	require.NoError(t, err)
	defer sub.Detach()

	snapshot := waitForCursorHubSnapshot(t, sub.Snapshots, 2*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
		return len(snapshot) == 1 && snapshot[0].User.ID == user.ID
	})

	assert.Equal(t, user, snapshot[0].User)
	assert.Nil(t, snapshot[0].Cursor.X)
	assert.Nil(t, snapshot[0].Cursor.Y)
}

func TestCursorHubRegistry_CoalescesNewestPositionPerConnection(t *testing.T) {
	registry := newCursorHubRegistryWithInterval(200 * time.Millisecond)
	projectID := uuid.New()
	user := cursorTestUser("user-a", "User A")

	sub, err := registry.AttachCursor(context.Background(), projectID, user)
	require.NoError(t, err)
	defer sub.Detach()

	_ = waitForCursorHubSnapshot(t, sub.Snapshots, 2*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
		return len(snapshot) == 1
	})

	x1, y1 := 1.0, 2.0
	x2, y2 := 3.0, 4.0
	require.NoError(t, registry.UpdateCursor(context.Background(), projectID, sub.ConnectionID, whiteboardSvc.CursorPosition{
		X: cursorFloatPtr(x1),
		Y: cursorFloatPtr(y1),
	}))
	require.NoError(t, registry.UpdateCursor(context.Background(), projectID, sub.ConnectionID, whiteboardSvc.CursorPosition{
		X: cursorFloatPtr(x2),
		Y: cursorFloatPtr(y2),
	}))

	snapshot := waitForCursorHubSnapshot(t, sub.Snapshots, 2*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
		if len(snapshot) != 1 || snapshot[0].Cursor.X == nil || snapshot[0].Cursor.Y == nil {
			return false
		}
		return *snapshot[0].Cursor.X == x2 && *snapshot[0].Cursor.Y == y2
	})

	require.NotNil(t, snapshot[0].Cursor.X)
	require.NotNil(t, snapshot[0].Cursor.Y)
	assert.Equal(t, x2, *snapshot[0].Cursor.X)
	assert.Equal(t, y2, *snapshot[0].Cursor.Y)
}

func TestCursorHubRegistry_DetachRemovesPresenceAndBroadcastsSnapshot(t *testing.T) {
	registry := NewCursorHubRegistry()
	projectID := uuid.New()
	owner := cursorTestUser("owner", "Owner")
	peer := cursorTestUser("peer", "Peer")

	ownerSub, err := registry.AttachCursor(context.Background(), projectID, owner)
	require.NoError(t, err)
	defer ownerSub.Detach()
	_ = waitForCursorHubSnapshot(t, ownerSub.Snapshots, 2*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
		return len(snapshot) == 1 && snapshot[0].User.ID == owner.ID
	})

	peerSub, err := registry.AttachCursor(context.Background(), projectID, peer)
	require.NoError(t, err)
	defer peerSub.Detach()
	_ = waitForCursorHubSnapshot(t, peerSub.Snapshots, 2*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
		return len(snapshot) == 2
	})

	ownerSub.Detach()
	requireCursorSnapshotChannelClosed(t, ownerSub.Snapshots)

	snapshot := waitForCursorHubSnapshot(t, peerSub.Snapshots, 2*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
		return len(snapshot) == 1 && snapshot[0].User.ID == peer.ID
	})
	assert.Equal(t, peer.ID, snapshot[0].User.ID)
}

func TestCursorHubRegistry_SlowSubscriberEvicted(t *testing.T) {
	registry := newCursorHubRegistryWithInterval(time.Hour)
	projectID := uuid.New()

	slow, err := registry.AttachCursor(context.Background(), projectID, cursorTestUser("slow", "Slow"))
	require.NoError(t, err)

	fast, err := registry.AttachCursor(context.Background(), projectID, cursorTestUser("fast", "Fast"))
	require.NoError(t, err)
	defer fast.Detach()

	fastDone := make(chan struct{})
	go func() {
		defer close(fastDone)
		for range fast.Snapshots {
		}
	}()

	for i := 0; i < cursorSnapshotBufferSize*2; i++ {
		temp, attachErr := registry.AttachCursor(context.Background(), projectID, cursorTestUser(uuid.NewString(), "Temp"))
		require.NoError(t, attachErr)
		temp.Detach()
	}

	requireCursorSnapshotChannelClosed(t, slow.Snapshots)

	select {
	case <-fastDone:
		t.Fatal("fast subscriber should remain attached")
	default:
	}
}

func TestCursorHub_DeliverSnapshotKeepsSubscriberThatDrainsBeforeGrace(t *testing.T) {
	hub := &cursorHub{projectID: uuid.New()}
	connectionID := uuid.NewString()
	send := make(chan []byte, 1)
	send <- []byte("stale")
	subs := map[string]chan []byte{connectionID: send}
	presenceByConnection := map[string]whiteboardSvc.CursorPresenceRecord{
		connectionID: {
			ConnectionID: connectionID,
			User:         cursorTestUser("user-a", "User A"),
			UpdatedAt:    time.Now().UTC(),
		},
	}

	evictedCh := make(chan bool, 1)
	go func() {
		evictedCh <- hub.deliverSnapshot(subs, presenceByConnection, []byte("fresh"))
	}()

	time.Sleep(10 * time.Millisecond)
	require.Equal(t, []byte("stale"), <-send)

	select {
	case evicted := <-evictedCh:
		require.False(t, evicted, "subscriber that drains before grace should not be evicted")
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for cursor snapshot delivery")
	}

	assert.Contains(t, subs, connectionID)
	assert.Contains(t, presenceByConnection, connectionID)
	assert.Equal(t, []byte("fresh"), <-send)
}

func TestCursorHubRegistry_TeardownAfterLastDetach(t *testing.T) {
	registry := NewCursorHubRegistry()
	projectID := uuid.New()

	sub, err := registry.AttachCursor(context.Background(), projectID, cursorTestUser("user-a", "User A"))
	require.NoError(t, err)
	_ = waitForCursorHubSnapshot(t, sub.Snapshots, 2*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
		return len(snapshot) == 1
	})

	sub.Detach()
	requireCursorSnapshotChannelClosed(t, sub.Snapshots)

	require.Eventually(t, func() bool {
		registry.mu.Lock()
		defer registry.mu.Unlock()
		_, ok := registry.hubs[projectID]
		return !ok
	}, 2*time.Second, 20*time.Millisecond)
}
