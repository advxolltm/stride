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

type whiteboardWSMessageEnvelope struct {
	Type routes.WSMessageType `json:"type"`
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
	pingCtx, pingCancel := context.WithCancel(context.Background())
	defer pingCancel()
	errCh := make(chan error, 3)

	go consumeProjectWSDisconnect(ws, errCh)
	go pingWSConn(pingCtx, ws, &writeMu, errCh)
	go h.forwardWhiteboardHubMessages(sub.Messages, ws, &writeMu, session.Expiry, errCh)

	runErr := <-errCh
	if runErr != nil && !websocket.IsCloseError(runErr, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		slog.Debug("whiteboard ws closed", "error", runErr, "user-id", session.UserID)
	}
	return nil
}

func (h whiteboardWSRouteHandler) forwardWhiteboardHubMessages(
	messages <-chan []byte,
	conn *websocket.Conn,
	writeMu *sync.Mutex,
	expiry time.Time,
	errCh chan<- error,
) {
	for payload := range messages {
		if isWSSessionExpired(expiry) {
			errCh <- nil
			return
		}

		var envelope whiteboardWSMessageEnvelope
		if err := json.Unmarshal(payload, &envelope); err != nil {
			slog.Debug("ignored invalid whiteboard ws payload", "error", err)
			continue
		}
		if !isWhiteboardWSEventType(envelope.Type) {
			continue
		}

		if err := writeWSMessage(conn, writeMu, websocket.TextMessage, payload); err != nil {
			errCh <- err
			return
		}
	}
	errCh <- nil
}

func isWhiteboardWSEventType(t routes.WSMessageType) bool {
	switch t {
	case routes.WhiteboardElementCreate, routes.WhiteboardElementUpdate, routes.WhiteboardElementDelete, routes.WhiteboardElementRollback:
		return true
	default:
		return false
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
