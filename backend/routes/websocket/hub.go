package websocket

import (
	"backend/routes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)



const (
	hubSendBufferSize  = 64
	hubSlowClientGrace = 5 * time.Second
)

var (
	errRegistryNil = errors.New("project hub registry not configured")
)

// HubMessage carries a single broadcast event with its envelope type already
// parsed once by the hub, so individual subscribers do not need to re-decode
// the JSON just to filter on type.
type HubMessage struct {
	Type    routes.WSMessageType
	Payload []byte
}

type subscriber struct {
	send chan HubMessage
}


type Subscription struct {
	Messages <-chan HubMessage
	detach   func()
}

func (s *Subscription) Detach() {
	if s == nil || s.detach == nil {
		return
	}
	s.detach()
	s.detach = nil
}

type projectHub struct {
	projectID uuid.UUID
	channel   string
	sub       *redis.PubSub
	cancel    context.CancelFunc
	registry  *ProjectHubRegistry

	mu     sync.RWMutex
	subs   map[*subscriber]struct{}
	closed bool
}

type ProjectHubRegistry struct {
	rdb *redis.Client

	mu   sync.Mutex
	hubs map[uuid.UUID]*projectHub
}

func NewProjectHubRegistry(rdb *redis.Client) *ProjectHubRegistry {
	return &ProjectHubRegistry{
		rdb:  rdb,
		hubs: make(map[uuid.UUID]*projectHub),
	}
}


func (r *ProjectHubRegistry) Attach(ctx context.Context, projectID uuid.UUID) (*Subscription, error) {
	if r == nil || r.rdb == nil {
		return nil, errRegistryNil
	}

	s := &subscriber{send: make(chan HubMessage, hubSendBufferSize)}

	for {
		hub, err := r.getOrCreateHub(ctx, projectID)
		if err != nil {
			return nil, err
		}
		if hub.addSubscriber(s) {
			return &Subscription{
				Messages: s.send,
				detach:   func() { hub.removeSubscriber(s) },
			}, nil
		}
	}
}

func (r *ProjectHubRegistry) getOrCreateHub(ctx context.Context, projectID uuid.UUID) (*projectHub, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if h, ok := r.hubs[projectID]; ok {
		return h, nil
	}

	channel := projectID.String()
	sub := r.rdb.Subscribe(context.Background(), channel)

	if _, err := sub.Receive(ctx); err != nil {
		_ = sub.Close()
		return nil, fmt.Errorf("project hub subscribe: %w", err)
	}

	hubCtx, cancel := context.WithCancel(context.Background())
	h := &projectHub{
		projectID: projectID,
		channel:   channel,
		sub:       sub,
		cancel:    cancel,
		registry:  r,
		subs:      make(map[*subscriber]struct{}),
	}
	r.hubs[projectID] = h
	go h.run(hubCtx)
	return h, nil
}

func (r *ProjectHubRegistry) tryShutdown(projectID uuid.UUID, h *projectHub) {
	r.mu.Lock()
	defer r.mu.Unlock()

	cur, ok := r.hubs[projectID]
	if !ok || cur != h {
		return
	}

	h.mu.Lock()
	if len(h.subs) > 0 {
		h.mu.Unlock()
		return
	}
	h.closed = true
	h.mu.Unlock()

	h.cancel()
	_ = h.sub.Close()
	delete(r.hubs, projectID)
}

func (h *projectHub) addSubscriber(s *subscriber) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return false
	}
	h.subs[s] = struct{}{}
	return true
}

func (h *projectHub) removeSubscriber(s *subscriber) {
	if s == nil {
		return
	}
	h.mu.Lock()
	_, present := h.subs[s]
	if present {
		delete(h.subs, s)
		close(s.send)
	}
	empty := len(h.subs) == 0
	h.mu.Unlock()

	if present && empty {
		h.registry.tryShutdown(h.projectID, h)
	}
}

func (h *projectHub) run(ctx context.Context) {
	ch := h.sub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			h.broadcast([]byte(msg.Payload))
		}
	}
}

// hubEnvelope mirrors the minimal shape of routes.WSMessage needed for fan-out
// routing. Decoding only the `type` field keeps the hot path allocation-light.
type hubEnvelope struct {
	Type routes.WSMessageType `json:"type"`
}

func (h *projectHub) broadcast(payload []byte) {
	// Decode only the envelope's `type` once here so each subscriber can filter
	// without re-parsing the same JSON N times. A parse failure is non-fatal:
	// the message is still delivered with a zero type (subscribers that filter
	// will skip it, those that don't still see the raw payload).
	var env hubEnvelope
	if err := json.Unmarshal(payload, &env); err != nil {
		slog.Debug("project hub payload missing typed envelope", "error", err, "projectID", h.projectID)
	}
	msg := HubMessage{Type: env.Type, Payload: payload}

	h.mu.RLock()
	if len(h.subs) == 0 {
		h.mu.RUnlock()
		return
	}

	var slow []*subscriber
	for s := range h.subs {
		if !deliver(s, msg) {
			slow = append(slow, s)
		}
	}
	h.mu.RUnlock()

	for _, s := range slow {
		h.removeSubscriber(s)
	}
}

func deliver(s *subscriber, msg HubMessage) bool {
	if s == nil {
		return false
	}
	select {
	case s.send <- msg:
		return true
	default:
	}

	timer := time.NewTimer(hubSlowClientGrace)
	defer timer.Stop()
	select {
	case s.send <- msg:
		return true
	case <-timer.C:
		return false
	}
}
