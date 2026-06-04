package websocket

import (
	"backend/models"
	"backend/routes"
	"backend/services/auth"
	"backend/services/project"
	"backend/services/user"
	whiteboardSvc "backend/services/whiteboard"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type whiteboardWSRouteHandler struct {
	authService    auth.AuthService
	projectService project.ProjectService
	userService    user.UserService
	upgrader       websocket.Upgrader
	rdb            *redis.Client
	hubs           *ProjectHubRegistry
	presenceStore  *whiteboardSvc.CursorPresenceStore
}

type whiteboardCursorUserResponse struct { //nolint:unused
	ID          string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	Name        string `json:"name" example:"Jane Doe"`
	AvatarSmall string `json:"avatarSmall" example:"/media/avatars/user-small.png"`
}

type whiteboardCursorPositionResponse struct { //nolint:unused
	X *float64 `json:"x" example:"120.5"`
	Y *float64 `json:"y" example:"340.25"`
}

type whiteboardCursorPresenceResponse struct { //nolint:unused
	User   whiteboardCursorUserResponse     `json:"user"`
	Cursor whiteboardCursorPositionResponse `json:"cursor"`
}

type whiteboardWSUpdateResponse struct { //nolint:unused
	Type    int `json:"type" example:"15"`
	Payload any `json:"payload"`
}

type whiteboardWSClientMessageMeta struct {
	ClientID    string `json:"clientId"`
	OperationID string `json:"operationId"`
}

type whiteboardWSClientMessage struct {
	Type    routes.WSMessageType           `json:"type"`
	Meta    *whiteboardWSClientMessageMeta `json:"meta,omitempty"`
	Payload json.RawMessage                `json:"payload"`
}

type whiteboardElementLiveWSUpdate struct {
	ElementID   string          `json:"elementId"`
	ElementType string          `json:"elementType"`
	Props       json.RawMessage `json:"props"`
	ZIndex      int             `json:"zIndex"`
}

type whiteboardElementLiveClearWSUpdate struct {
	ElementID string `json:"elementId"`
}

// whiteboardLiveCoalesceInterval bounds how often a single connection may
// publish a LiveUpdate for the same element to Redis. Multiple frames received
// within one window for the same elementId are collapsed into the most recent
// one, keeping publish/broadcast cost bounded regardless of how fast a client
// streams frames during a drag.
const whiteboardLiveCoalesceInterval = 33 * time.Millisecond

// whiteboardLiveItem is one parsed inbound live message awaiting publish.
type whiteboardLiveItem struct {
	messageType routes.WSMessageType
	meta        *routes.WSMessageMeta
	payload     any
	elementID   string
}

func newWhiteboardWSRouteHandler(
	authService auth.AuthService,
	projectService project.ProjectService,
	userService user.UserService,
	rdb *redis.Client,
	hubs *ProjectHubRegistry,
) whiteboardWSRouteHandler {
	return whiteboardWSRouteHandler{
		authService:    authService,
		projectService: projectService,
		userService:    userService,
		rdb:            rdb,
		hubs:           hubs,
		presenceStore:  whiteboardSvc.NewCursorPresenceStore(rdb),
		upgrader:       newWSUpgrader(),
	}
}

func (h whiteboardWSRouteHandler) addRoutes(ws *echo.Group) {
	g := ws.Group("/project/:projectId/whiteboard", h.authService.AuthenticatedMiddleware())
	g.GET("", h.connectGET)
	g.GET("/cursor", h.cursorConnectGET)
}

// GET /ws/project/:projectId/whiteboard
//
//	@Summary	Connect to whiteboard element updates websocket
//	@Description	Upgrades HTTP connection to WebSocket. After successful handshake, server forwards only whiteboard element update envelopes from the shared project websocket stream.
//	@Tags		whiteboard
//	@Param		projectId	path		string	true	"Project ID"
//	@Success	101		{object}	whiteboardWSUpdateResponse	"Switching Protocols. Subsequent WebSocket text frames contain whiteboard element update envelopes."
//	@Failure	400		{object}	routes.ErrorResponse		"invalid project id"
//	@Failure	401		{object}	routes.ErrorResponse		"unauthorized"
//	@Failure	500		{object}	routes.ErrorResponse		"internal server error"
//	@Security	Auth
//	@Router		/ws/project/{projectId}/whiteboard [get]
func (h whiteboardWSRouteHandler) connectGET(c *echo.Context) error {
	ctx := c.Request().Context()
	session, err := authorizeProjectWSSession(c, h.authService, h.projectService)
	if err != nil || session == nil {
		return err
	}

	if h.hubs == nil {
		slog.Error("whiteboard websocket missing project hub registry", "projectID", session.ProjectID, "userID", session.UserID)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "internal server error"})
	}

	sub, err := h.hubs.Attach(ctx, session.ProjectID)
	if err != nil {
		slog.Error("failed to attach whiteboard websocket to project hub", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "internal server error"})
	}
	defer sub.Detach()

	ws, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade whiteboard ws", "error", err)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	defer func() {
		if err := ws.Close(); err != nil {
			slog.Error("failed to close whiteboard websocket connection", "error", err)
		}
	}()

	ws.SetReadLimit(wsMaxMessageSize)
	if err := ws.SetReadDeadline(time.Now().Add(wsPongWait)); err != nil {
		slog.Error("failed to set whiteboard read deadline", "error", err)
		return nil
	}
	ws.SetPongHandler(func(string) error {
		return ws.SetReadDeadline(time.Now().Add(wsPongWait))
	})

	var writeMu sync.Mutex
	connCtx, connCancel := context.WithCancel(context.Background())
	defer connCancel()
	errCh := make(chan error, 4)
	liveItems := make(chan whiteboardLiveItem, 64)

	go pingWSConn(connCtx, ws, &writeMu, errCh)
	go h.forwardWhiteboardHubMessages(sub.Messages, ws, &writeMu, session.Expiry, errCh)
	go h.coalesceWhiteboardLiveUpdates(connCtx, session.ProjectID, liveItems, errCh)
	go h.consumeWhiteboardLiveClientMessages(
		connCtx,
		ws,
		session.UserID,
		session.Expiry,
		liveItems,
		errCh,
	)

	runErr := <-errCh
	connCancel()
	if runErr != nil && !websocket.IsCloseError(runErr, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		slog.Debug("whiteboard ws closed", "error", runErr, "user-id", session.UserID)
	}
	return nil
}

func (h whiteboardWSRouteHandler) forwardWhiteboardHubMessages(
	messages <-chan HubMessage,
	conn *websocket.Conn,
	writeMu *sync.Mutex,
	expiry time.Time,
	errCh chan<- error,
) {
	forwardFilteredHubMessages(messages, conn, writeMu, expiry, isWhiteboardWSEventType, errCh)
}

func parseWhiteboardLiveClientMessage(
	payload []byte,
) (routes.WSMessageType, string, string, any, bool) {
	var message whiteboardWSClientMessage
	if err := json.Unmarshal(payload, &message); err != nil {
		return 0, "", "", nil, false
	}

	clientID := ""
	operationID := ""
	if message.Meta != nil {
		clientID = message.Meta.ClientID
		operationID = message.Meta.OperationID
	}

	switch message.Type {
	case routes.WhiteboardElementLiveUpdate:
		var liveUpdate whiteboardElementLiveWSUpdate
		if err := json.Unmarshal(message.Payload, &liveUpdate); err != nil {
			return 0, "", "", nil, false
		}

		if liveUpdate.ElementID == "" || liveUpdate.ElementType == "" || len(liveUpdate.Props) == 0 {
			return 0, "", "", nil, false
		}

		return message.Type, clientID, operationID, liveUpdate, true
	case routes.WhiteboardElementLiveClear:
		var liveClear whiteboardElementLiveClearWSUpdate
		if err := json.Unmarshal(message.Payload, &liveClear); err != nil {
			return 0, "", "", nil, false
		}

		if liveClear.ElementID == "" {
			return 0, "", "", nil, false
		}

		return message.Type, clientID, operationID, liveClear, true
	default:
		return 0, "", "", nil, false
	}
}

func (h whiteboardWSRouteHandler) consumeWhiteboardLiveClientMessages(
	ctx context.Context,
	conn *websocket.Conn,
	userID uuid.UUID,
	expiry time.Time,
	out chan<- whiteboardLiveItem,
	errCh chan<- error,
) {
	defer close(out)

	for {
		if isWSSessionExpired(expiry) {
			errCh <- websocket.ErrCloseSent
			return
		}

		_, payload, err := conn.ReadMessage()
		if err != nil {
			errCh <- err
			return
		}

		messageType, clientID, operationID, parsedPayload, ok := parseWhiteboardLiveClientMessage(payload)
		if !ok {
			slog.Debug("ignored invalid whiteboard live client payload", "userID", userID)
			continue
		}

		item := whiteboardLiveItem{
			messageType: messageType,
			meta: &routes.WSMessageMeta{
				OriginUserID: &userID,
				ClientID:     clientID,
				OperationID:  operationID,
			},
			payload:   parsedPayload,
			elementID: liveItemElementID(parsedPayload),
		}

		select {
		case out <- item:
		case <-ctx.Done():
			errCh <- nil
			return
		}
	}
}

func liveItemElementID(payload any) string {
	switch v := payload.(type) {
	case whiteboardElementLiveWSUpdate:
		return v.ElementID
	case whiteboardElementLiveClearWSUpdate:
		return v.ElementID
	default:
		return ""
	}
}

// coalesceWhiteboardLiveUpdates is the single owner of the per-connection
// inbound publish pipeline. It collapses successive LiveUpdate frames for the
// same elementId into the latest value and flushes at most once per
// whiteboardLiveCoalesceInterval. LiveClear frames bypass coalescing and also
// evict any pending LiveUpdate for the same element so the clear is never
// re-overwritten by a stale frame.
func (h whiteboardWSRouteHandler) coalesceWhiteboardLiveUpdates(
	ctx context.Context,
	projectID uuid.UUID,
	in <-chan whiteboardLiveItem,
	errCh chan<- error,
) {
	pending := make(map[string]whiteboardLiveItem)
	ticker := time.NewTicker(whiteboardLiveCoalesceInterval)
	defer ticker.Stop()

	publish := func(item whiteboardLiveItem) error {
		return routes.SendWSUpdateWithMeta(
			ctx,
			h.rdb,
			projectID,
			item.messageType,
			item.meta,
			item.payload,
		)
	}

	flushPending := func() error {
		for k, item := range pending {
			if err := publish(item); err != nil {
				return err
			}
			delete(pending, k)
		}
		return nil
	}

	for {
		select {
		case <-ctx.Done():
			errCh <- nil
			return
		case item, ok := <-in:
			if !ok {
				if err := flushPending(); err != nil {
					errCh <- err
					return
				}
				errCh <- nil
				return
			}
			if item.messageType == routes.WhiteboardElementLiveClear {
				delete(pending, item.elementID)
				if err := publish(item); err != nil {
					errCh <- err
					return
				}
				continue
			}
			// LiveUpdate: keep only the most recent frame per element.
			if item.elementID == "" {
				if err := publish(item); err != nil {
					errCh <- err
					return
				}
				continue
			}
			pending[item.elementID] = item
		case <-ticker.C:
			if err := flushPending(); err != nil {
				errCh <- err
				return
			}
		}
	}
}

// GET /ws/project/:projectId/whiteboard/cursor
//
//	@Summary	Connect to whiteboard cursor websocket
//	@Description	Upgrades HTTP connection to WebSocket. After successful handshake, server sends full cursor presence snapshots for all connected whiteboard users.
//	@Tags		whiteboard
//	@Param		projectId	path		string	true	"Project ID"
//	@Success	101		{array}		whiteboardCursorPresenceResponse	"Switching Protocols. Subsequent WebSocket text frames contain full cursor presence snapshots."
//	@Failure	400		{object}	routes.ErrorResponse				"invalid project id"
//	@Failure	401		{object}	routes.ErrorResponse				"unauthorized"
//	@Failure	500		{object}	routes.ErrorResponse				"internal server error"
//	@Security	Auth
//	@Router		/ws/project/{projectId}/whiteboard/cursor [get]
func (h whiteboardWSRouteHandler) cursorConnectGET(c *echo.Context) error {
	requestCtx := c.Request().Context()
	session, err := authorizeProjectWSSession(c, h.authService, h.projectService)
	if err != nil || session == nil {
		return err
	}

	if h.rdb == nil || h.presenceStore == nil {
		slog.Error("whiteboard cursor websocket missing redis client", "projectID", session.ProjectID, "userID", session.UserID)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "internal server error"})
	}

	if isWSSessionExpired(session.Expiry) {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	currentUser, err := h.userService.GetUser(requestCtx, session.UserID)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	conn, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade whiteboard cursor ws", "error", err)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	closeConn := func() {
		if conn == nil {
			return
		}
		if err := conn.Close(); err != nil {
			slog.Error("failed to close whiteboard cursor websocket connection", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		}
		conn = nil
	}
	defer closeConn()
	conn.SetReadLimit(wsMaxMessageSize)
	if err := conn.SetReadDeadline(time.Now().Add(wsPongWait)); err != nil {
		slog.Error("failed to set whiteboard cursor read deadline", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		return nil
	}

	connectionID := uuid.NewString()
	redisCtx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sub := h.rdb.Subscribe(redisCtx, whiteboardSvc.CursorPresenceChannel(session.ProjectID))
	closeSub := func() {
		if sub == nil {
			return
		}
		if err := sub.Close(); err != nil {
			slog.Error("failed to close whiteboard cursor redis subscription", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		}
		sub = nil
	}
	defer closeSub()
	channel := sub.Channel()

	presenceRecord := &whiteboardSvc.CursorPresenceRecord{
		ConnectionID: connectionID,
		User:         mapWhiteboardCursorUser(currentUser),
		Cursor:       whiteboardSvc.CursorPosition{},
		UpdatedAt:    time.Now().UTC(),
	}

	conn.SetPongHandler(func(string) error {
		if err := conn.SetReadDeadline(time.Now().Add(wsPongWait)); err != nil {
			return err
		}
		return h.presenceStore.RefreshConnection(redisCtx, session.ProjectID, presenceRecord, time.Now().UTC())
	})

	if err := h.presenceStore.PutConnection(redisCtx, session.ProjectID, *presenceRecord); err != nil {
		slog.Error("failed to store whiteboard cursor presence", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		return nil
	}
	if err := h.presenceStore.PublishSnapshot(redisCtx, session.ProjectID); err != nil {
		slog.Error("failed to publish whiteboard cursor snapshot", "error", err, "projectID", session.ProjectID)
		return nil
	}

	errCh := make(chan error, 3)
	var writeMu sync.Mutex

	go h.forwardWhiteboardCursorSnapshots(channel, conn, &writeMu, session.Expiry, errCh)
	go h.consumeWhiteboardCursorUpdates(redisCtx, conn, session.ProjectID, presenceRecord, session.Expiry, errCh)
	go pingWSConn(redisCtx, conn, &writeMu, errCh)

	runErrs := []error{<-errCh}
	cancel()
	closeSub()
	closeConn()
	for range 2 {
		runErrs = append(runErrs, <-errCh)
	}

	if err := h.presenceStore.RemoveConnection(context.Background(), session.ProjectID, connectionID); err != nil {
		slog.Error("failed to remove whiteboard cursor presence", "error", err, "projectID", session.ProjectID, "connectionID", connectionID)
	} else if err := h.presenceStore.PublishSnapshot(context.Background(), session.ProjectID); err != nil {
		slog.Error("failed to publish whiteboard cursor snapshot after disconnect", "error", err, "projectID", session.ProjectID)
	}

	for _, runErr := range runErrs {
		if runErr == nil || errors.Is(runErr, websocket.ErrCloseSent) || websocket.IsCloseError(runErr, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
			continue
		}
		slog.Debug("whiteboard cursor ws closed", "error", runErr, "projectID", session.ProjectID, "userID", session.UserID)
		break
	}

	return nil
}

func mapWhiteboardCursorUser(currentUser *models.User) whiteboardSvc.CursorUser {
	name := currentUser.Username
	if currentUser.FullName != nil && *currentUser.FullName != "" {
		name = *currentUser.FullName
	}

	avatarSmall := ""
	if currentUser.AvatarURL != nil {
		avatarSmall = currentUser.AvatarURL.Small
	}

	return whiteboardSvc.CursorUser{
		ID:          currentUser.ID.String(),
		Name:        name,
		AvatarSmall: avatarSmall,
	}
}

func (h whiteboardWSRouteHandler) forwardWhiteboardCursorSnapshots(
	channel <-chan *redis.Message,
	conn *websocket.Conn,
	writeMu *sync.Mutex,
	expiry time.Time,
	errCh chan<- error,
) {
	for msg := range channel {
		if !expiry.IsZero() && expiry.Before(time.Now()) {
			errCh <- websocket.ErrCloseSent
			return
		}

		if err := writeWSMessage(conn, writeMu, websocket.TextMessage, []byte(msg.Payload)); err != nil {
			errCh <- err
			return
		}
	}

	errCh <- nil
}

func (h whiteboardWSRouteHandler) consumeWhiteboardCursorUpdates(
	ctx context.Context,
	conn *websocket.Conn,
	projectID uuid.UUID,
	presenceRecord *whiteboardSvc.CursorPresenceRecord,
	expiry time.Time,
	errCh chan<- error,
) {
	for {
		if isWSSessionExpired(expiry) {
			errCh <- websocket.ErrCloseSent
			return
		}

		_, payload, err := conn.ReadMessage()
		if err != nil {
			errCh <- err
			return
		}

		var message whiteboardSvc.CursorClientMessage
		if err := json.Unmarshal(payload, &message); err != nil {
			slog.Debug("ignored invalid whiteboard cursor payload", "error", err)
			continue
		}

		presenceRecord.Cursor = message.Cursor
		if err := h.presenceStore.RefreshConnection(ctx, projectID, presenceRecord, time.Now().UTC()); err != nil {
			errCh <- err
			return
		}
		if err := h.presenceStore.PublishSnapshot(ctx, projectID); err != nil {
			errCh <- err
			return
		}
	}
}
