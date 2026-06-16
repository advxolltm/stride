package websocket

import (
	whiteboardSvc "backend/services/whiteboard"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	cursorSnapshotBufferSize = 16
	cursorBroadcastInterval  = 40 * time.Millisecond
	cursorSlowClientGrace    = 100 * time.Millisecond
)

var errCursorHubRegistryNil = errors.New("cursor hub registry not configured")

type cursorAttachRequest struct {
	connectionID string
	user         whiteboardSvc.CursorUser
	send         chan []byte
	ack          chan bool
}

type cursorUpdateRequest struct {
	connectionID string
	cursor       whiteboardSvc.CursorPosition
	ack          chan struct{}
}

type cursorDetachRequest struct {
	connectionID string
	ack          chan struct{}
}

type cursorHub struct {
	projectID uuid.UUID
	registry  *CursorHubRegistry

	attachCh   chan cursorAttachRequest
	updateCh   chan cursorUpdateRequest
	detachCh   chan cursorDetachRequest
	shutdownCh chan struct{}
	done       chan struct{}
}

type CursorSubscription struct {
	ConnectionID string
	Snapshots    <-chan []byte

	detach func()
	once   sync.Once
}

func (s *CursorSubscription) Detach() {
	if s == nil || s.detach == nil {
		return
	}
	s.once.Do(s.detach)
}

type CursorHubRegistry struct {
	broadcastInterval time.Duration

	mu   sync.Mutex
	hubs map[uuid.UUID]*cursorHub
}

func NewCursorHubRegistry() *CursorHubRegistry {
	return newCursorHubRegistryWithInterval(cursorBroadcastInterval)
}

func newCursorHubRegistryWithInterval(broadcastInterval time.Duration) *CursorHubRegistry {
	return &CursorHubRegistry{
		broadcastInterval: broadcastInterval,
		hubs:              make(map[uuid.UUID]*cursorHub),
	}
}

func (r *CursorHubRegistry) AttachCursor(
	ctx context.Context,
	projectID uuid.UUID,
	user whiteboardSvc.CursorUser,
) (*CursorSubscription, error) {
	if r == nil {
		return nil, errCursorHubRegistryNil
	}

	connectionID := uuid.NewString()
	send := make(chan []byte, cursorSnapshotBufferSize)

	for {
		hub := r.getOrCreateHub(projectID)
		ack := make(chan bool, 1)
		req := cursorAttachRequest{
			connectionID: connectionID,
			user:         user,
			send:         send,
			ack:          ack,
		}

		select {
		case hub.attachCh <- req:
		case <-hub.done:
			continue
		case <-ctx.Done():
			return nil, ctx.Err()
		}

		select {
		case ok := <-ack:
			if !ok {
				continue
			}
			return &CursorSubscription{
				ConnectionID: connectionID,
				Snapshots:    send,
				detach:       func() { r.DetachCursor(projectID, connectionID) },
			}, nil
		case <-hub.done:
			continue
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

func (r *CursorHubRegistry) UpdateCursor(
	ctx context.Context,
	projectID uuid.UUID,
	connectionID string,
	cursor whiteboardSvc.CursorPosition,
) error {
	if r == nil {
		return errCursorHubRegistryNil
	}

	hub := r.getHub(projectID)
	if hub == nil {
		return nil
	}

	ack := make(chan struct{}, 1)
	req := cursorUpdateRequest{connectionID: connectionID, cursor: cursor, ack: ack}
	select {
	case hub.updateCh <- req:
	case <-hub.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}

	select {
	case <-ack:
		return nil
	case <-hub.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (r *CursorHubRegistry) DetachCursor(projectID uuid.UUID, connectionID string) {
	if r == nil || connectionID == "" {
		return
	}

	hub := r.getHub(projectID)
	if hub == nil {
		return
	}

	ack := make(chan struct{}, 1)
	req := cursorDetachRequest{connectionID: connectionID, ack: ack}
	select {
	case hub.detachCh <- req:
	case <-hub.done:
		return
	}

	select {
	case <-ack:
	case <-hub.done:
	}
}

func (r *CursorHubRegistry) Shutdown(projectID uuid.UUID) {
	if r == nil {
		return
	}

	hub := r.getHub(projectID)
	if hub == nil {
		return
	}

	select {
	case hub.shutdownCh <- struct{}{}:
	case <-hub.done:
	}
}

func (r *CursorHubRegistry) getHub(projectID uuid.UUID) *cursorHub {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.hubs[projectID]
}

func (r *CursorHubRegistry) getOrCreateHub(projectID uuid.UUID) *cursorHub {
	r.mu.Lock()
	defer r.mu.Unlock()

	if hub, ok := r.hubs[projectID]; ok {
		return hub
	}

	hub := &cursorHub{
		projectID:  projectID,
		registry:   r,
		attachCh:   make(chan cursorAttachRequest),
		updateCh:   make(chan cursorUpdateRequest),
		detachCh:   make(chan cursorDetachRequest),
		shutdownCh: make(chan struct{}),
		done:       make(chan struct{}),
	}
	r.hubs[projectID] = hub
	go hub.run(r.broadcastInterval)
	return hub
}

func (r *CursorHubRegistry) removeHub(projectID uuid.UUID, hub *cursorHub) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.hubs[projectID] == hub {
		delete(r.hubs, projectID)
	}
}

func (h *cursorHub) run(broadcastInterval time.Duration) {
	defer close(h.done)
	defer h.registry.removeHub(h.projectID, h)

	subs := make(map[string]chan []byte)
	presenceByConnection := make(map[string]whiteboardSvc.CursorPresenceRecord)
	userByID := make(map[string]whiteboardSvc.CursorUser)
	pending := make(map[string]whiteboardSvc.CursorPosition)

	ticker := time.NewTicker(broadcastInterval)
	defer ticker.Stop()

	closeAll := func() {
		for connectionID, send := range subs {
			close(send)
			delete(subs, connectionID)
		}
		clear(presenceByConnection)
		clear(userByID)
		clear(pending)
	}

	for {
		select {
		case req := <-h.attachCh:
			subs[req.connectionID] = req.send
			userByID[req.user.ID] = req.user
			presenceByConnection[req.connectionID] = whiteboardSvc.CursorPresenceRecord{
				ConnectionID: req.connectionID,
				User:         req.user,
				Cursor:       whiteboardSvc.CursorPosition{},
				UpdatedAt:    time.Now().UTC(),
			}
			req.ack <- true
			h.broadcastSnapshot(subs, presenceByConnection, userByID)
			if len(subs) == 0 {
				return
			}

		case req := <-h.updateCh:
			if _, ok := presenceByConnection[req.connectionID]; ok {
				pending[req.connectionID] = req.cursor
			}
			req.ack <- struct{}{}

		case req := <-h.detachCh:
			h.detachConnection(req.connectionID, subs, presenceByConnection, pending)
			req.ack <- struct{}{}
			if len(subs) == 0 {
				return
			}
			h.broadcastSnapshot(subs, presenceByConnection, userByID)
			if len(subs) == 0 {
				return
			}

		case <-ticker.C:
			if len(pending) == 0 {
				continue
			}
			now := time.Now().UTC()
			for connectionID, cursor := range pending {
				record, ok := presenceByConnection[connectionID]
				if !ok {
					continue
				}
				record.Cursor = cursor
				record.UpdatedAt = now
				presenceByConnection[connectionID] = record
			}
			clear(pending)
			h.broadcastSnapshot(subs, presenceByConnection, userByID)
			if len(subs) == 0 {
				return
			}

		case <-h.shutdownCh:
			closeAll()
			return
		}
	}
}

func (h *cursorHub) detachConnection(
	connectionID string,
	subs map[string]chan []byte,
	presenceByConnection map[string]whiteboardSvc.CursorPresenceRecord,
	pending map[string]whiteboardSvc.CursorPosition,
) {
	send, ok := subs[connectionID]
	if ok {
		close(send)
		delete(subs, connectionID)
	}
	delete(presenceByConnection, connectionID)
	delete(pending, connectionID)
}

func (h *cursorHub) broadcastSnapshot(
	subs map[string]chan []byte,
	presenceByConnection map[string]whiteboardSvc.CursorPresenceRecord,
	userByID map[string]whiteboardSvc.CursorUser,
) {
	snapshot := buildCursorSnapshot(presenceByConnection, userByID)
	payload, err := json.Marshal(snapshot)
	if err != nil {
		slog.Error("failed to marshal cursor snapshot", "error", err, "projectID", h.projectID)
		return
	}

	evicted := h.deliverSnapshot(subs, presenceByConnection, payload)
	if !evicted || len(subs) == 0 {
		return
	}

	snapshot = buildCursorSnapshot(presenceByConnection, userByID)
	payload, err = json.Marshal(snapshot)
	if err != nil {
		slog.Error("failed to marshal cursor snapshot after eviction", "error", err, "projectID", h.projectID)
		return
	}
	h.deliverSnapshot(subs, presenceByConnection, payload)
}

func (h *cursorHub) deliverSnapshot(
	subs map[string]chan []byte,
	presenceByConnection map[string]whiteboardSvc.CursorPresenceRecord,
	payload []byte,
) bool {
	evicted := false
	for connectionID, send := range subs {
		if !deliverCursorSnapshot(send, payload) {
			close(send)
			delete(subs, connectionID)
			delete(presenceByConnection, connectionID)
			evicted = true
		}
	}
	return evicted
}

func deliverCursorSnapshot(send chan []byte, payload []byte) bool {
	select {
	case send <- payload:
		return true
	default:
	}

	timer := time.NewTimer(cursorSlowClientGrace)
	defer timer.Stop()
	select {
	case send <- payload:
		return true
	case <-timer.C:
		return false
	}
}

func buildCursorSnapshot(
	presenceByConnection map[string]whiteboardSvc.CursorPresenceRecord,
	userByID map[string]whiteboardSvc.CursorUser,
) []whiteboardSvc.CursorPresence {
	latestByUser := make(map[string]whiteboardSvc.CursorPresenceRecord, len(presenceByConnection))
	for _, record := range presenceByConnection {
		existing, ok := latestByUser[record.User.ID]
		if !ok || record.UpdatedAt.After(existing.UpdatedAt) {
			latestByUser[record.User.ID] = record
		}
	}

	snapshot := make([]whiteboardSvc.CursorPresence, 0, len(latestByUser))
	for userID, record := range latestByUser {
		user := record.User
		if latestUser, ok := userByID[userID]; ok {
			user = latestUser
		}
		snapshot = append(snapshot, whiteboardSvc.CursorPresence{
			User:   user,
			Cursor: record.Cursor,
		})
	}

	sort.Slice(snapshot, func(i, j int) bool {
		if snapshot[i].User.Name == snapshot[j].User.Name {
			return snapshot[i].User.ID < snapshot[j].User.ID
		}
		return snapshot[i].User.Name < snapshot[j].User.Name
	})

	return snapshot
}
