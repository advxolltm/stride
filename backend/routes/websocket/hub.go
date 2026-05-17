package websocket

import (
	"context"
	"errors"
	"fmt"
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

type subscriber struct {
	send chan []byte
}


type Subscription struct {
	Messages <-chan []byte
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

	s := &subscriber{send: make(chan []byte, hubSendBufferSize)}

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

func (h *projectHub) broadcast(payload []byte) {
	h.mu.RLock()
	if len(h.subs) == 0 {
		h.mu.RUnlock()
		return
	}

	var slow []*subscriber
	for s := range h.subs {
		if !deliver(s, payload) {
			slow = append(slow, s)
		}
	}
	h.mu.RUnlock()

	for _, s := range slow {
		h.removeSubscriber(s)
	}
}

func deliver(s *subscriber, payload []byte) bool {
	if s == nil {
		return false
	}
	select {
	case s.send <- payload:
		return true
	default:
	}

	timer := time.NewTimer(hubSlowClientGrace)
	defer timer.Stop()
	select {
	case s.send <- payload:
		return true
	case <-timer.C:
		return false
	}
}
