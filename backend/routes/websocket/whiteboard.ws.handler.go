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
	presenceStore  *whiteboardSvc.CursorPresenceStore
	sceneStore     *whiteboardSvc.WhiteboardSceneStore
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

type whiteboardSceneResponse struct { //nolint:unused
	Elements []any `json:"elements"`
	AppState any   `json:"appState"`
	Files    any   `json:"files"`
}

type whiteboardSceneMessageResponse struct { //nolint:unused
	Type      string                  `json:"type" example:"scene:sync"`
	Revision  int64                   `json:"revision,omitempty" example:"12"`
	Scene     whiteboardSceneResponse `json:"scene,omitempty"`
	UpdatedAt string                  `json:"updatedAt,omitempty" example:"2026-01-01T00:00:00Z"`
	Code      string                  `json:"code,omitempty" example:"invalid_message"`
}

func newWhiteboardWSRouteHandler(
	authService auth.AuthService,
	projectService project.ProjectService,
	userService user.UserService,
	whiteboardService whiteboardSvc.WhiteboardService,
	rdb *redis.Client,
) whiteboardWSRouteHandler {
	var sceneStore *whiteboardSvc.WhiteboardSceneStore
	if whiteboardService != nil {
		sceneStore = whiteboardSvc.NewWhiteboardSceneStore(rdb, whiteboardService)
	}

	return whiteboardWSRouteHandler{
		authService:    authService,
		projectService: projectService,
		userService:    userService,
		rdb:            rdb,
		presenceStore:  whiteboardSvc.NewCursorPresenceStore(rdb),
		sceneStore:     sceneStore,
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
//	@Summary	Connect to whiteboard scene websocket
//	@Description	Upgrades HTTP connection to WebSocket for collaborative whiteboard drawing. The connection is scoped to one project and requires project membership.
//	@Description	After successful handshake, the server immediately sends a `scene:sync` text frame containing the current Excalidraw scene, revision, and update timestamp.
//	@Description	Client update frames must be JSON text frames with `type: "scene:update"` and a `scene` object containing `elements`, `appState`, and `files`.
//	@Description	Accepted updates are stored as hot state in Redis, revisioned, published to all whiteboard scene subscribers, and flushed to `whiteboards.canvas_state` by the backend.
//	@Description	Server success frames use `type: "scene:sync"`. Server validation/error frames use `type: "error"` with codes such as `invalid_message`, `invalid_message_type`, `invalid_scene`, or `load_failed`.
//	@Tags		whiteboard
//	@Param		projectId	path		string	true	"Project ID"
//	@Success	101		{object}	whiteboardSceneMessageResponse	"Switching Protocols. Subsequent WebSocket text frames contain whiteboard scene sync or error messages."
//	@Failure	400		{object}	routes.ErrorResponse			"invalid project id"
//	@Failure	401		{object}	routes.ErrorResponse			"unauthorized"
//	@Failure	500		{object}	routes.ErrorResponse			"internal server error"
//	@Security	Auth
//	@Router		/ws/project/{projectId}/whiteboard [get]
func (h whiteboardWSRouteHandler) connectGET(c *echo.Context) error {
	requestCtx := c.Request().Context()
	session, err := authorizeProjectWSSession(c, h.authService, h.projectService)
	if err != nil {
		return err
	}

	if isWSSessionExpired(session.Expiry) {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	if h.sceneStore == nil {
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "whiteboard scene store not configured"})
	}

	conn, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade whiteboard ws", "error", err)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	conn.SetReadLimit(whiteboardSvc.WhiteboardSceneMessageReadLimit)

	closeConn := func() {
		if conn == nil {
			return
		}
		if err := conn.Close(); err != nil {
			slog.Error("failed to close whiteboard websocket connection", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		}
		conn = nil
	}
	defer closeConn()

	redisCtx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sub := h.rdb.Subscribe(redisCtx, whiteboardSvc.WhiteboardSceneChannel(session.ProjectID))
	closeSub := func() {
		if sub == nil {
			return
		}
		if err := sub.Close(); err != nil {
			slog.Error("failed to close whiteboard redis subscription", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		}
		sub = nil
	}
	defer closeSub()

	if _, err := sub.Receive(redisCtx); err != nil {
		slog.Error("failed to subscribe to whiteboard scene updates", "error", err, "projectID", session.ProjectID)
		return nil
	}
	channel := sub.Channel()

	snapshot, err := h.sceneStore.LoadSnapshot(requestCtx, session.UserID, session.ProjectID)
	if err != nil {
		slog.Error("failed to load whiteboard scene snapshot", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		var writeMu sync.Mutex
		_ = writeWhiteboardSceneError(conn, &writeMu, "load_failed")
		return nil
	}

	var writeMu sync.Mutex
	if err := writeWhiteboardSceneSync(conn, &writeMu, snapshot); err != nil {
		slog.Debug("whiteboard ws initial write failed", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		return nil
	}

	errCh := make(chan error, 2)
	go h.forwardWhiteboardSceneSnapshots(channel, conn, session.Expiry, &writeMu, errCh)
	go h.consumeWhiteboardSceneUpdates(redisCtx, conn, session, &writeMu, errCh)

	firstErr := <-errCh
	cancel()
	closeSub()
	closeConn()
	secondErr := <-errCh

	if err := h.sceneStore.FlushDirty(context.Background(), session.ProjectID); err != nil {
		slog.Error("failed to flush whiteboard scene after disconnect", "error", err, "projectID", session.ProjectID)
	}

	for _, runErr := range []error{firstErr, secondErr} {
		if runErr == nil || errors.Is(runErr, websocket.ErrCloseSent) || websocket.IsCloseError(runErr, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
			continue
		}
		slog.Debug("whiteboard ws closed", "error", runErr, "projectID", session.ProjectID, "userID", session.UserID)
		break
	}

	return nil
}

func (h whiteboardWSRouteHandler) forwardWhiteboardSceneSnapshots(
	channel <-chan *redis.Message,
	conn *websocket.Conn,
	expiry time.Time,
	writeMu *sync.Mutex,
	errCh chan<- error,
) {
	for msg := range channel {
		if isWSSessionExpired(expiry) {
			errCh <- websocket.ErrCloseSent
			return
		}

		if err := writeWhiteboardScenePayload(conn, writeMu, []byte(msg.Payload)); err != nil {
			errCh <- err
			return
		}
	}

	errCh <- nil
}

func (h whiteboardWSRouteHandler) consumeWhiteboardSceneUpdates(
	ctx context.Context,
	conn *websocket.Conn,
	session *projectWSSession,
	writeMu *sync.Mutex,
	errCh chan<- error,
) {
	for {
		if isWSSessionExpired(session.Expiry) {
			errCh <- websocket.ErrCloseSent
			return
		}

		_, payload, err := conn.ReadMessage()
		if err != nil {
			errCh <- err
			return
		}

		var message whiteboardSvc.WhiteboardSceneClientMessage
		if err := json.Unmarshal(payload, &message); err != nil {
			slog.Debug("ignored invalid whiteboard scene payload", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
			if err := writeWhiteboardSceneError(conn, writeMu, "invalid_message"); err != nil {
				errCh <- err
				return
			}
			continue
		}

		if message.Type != whiteboardSvc.WhiteboardSceneMessageTypeUpdate {
			if err := writeWhiteboardSceneError(conn, writeMu, "invalid_message_type"); err != nil {
				errCh <- err
				return
			}
			continue
		}
		if message.Scene == nil {
			if err := writeWhiteboardSceneError(conn, writeMu, "invalid_message"); err != nil {
				errCh <- err
				return
			}
			continue
		}

		snapshot, err := h.sceneStore.SaveScene(ctx, session.ProjectID, *message.Scene)
		if err != nil {
			if errors.Is(err, whiteboardSvc.ErrInvalidWhiteboardScene) {
				if writeErr := writeWhiteboardSceneError(conn, writeMu, "invalid_scene"); writeErr != nil {
					errCh <- writeErr
					return
				}
				continue
			}

			errCh <- err
			return
		}

		if err := h.sceneStore.PublishSnapshot(ctx, session.ProjectID, snapshot); err != nil {
			errCh <- err
			return
		}
	}
}

func writeWhiteboardSceneSync(
	conn *websocket.Conn,
	writeMu *sync.Mutex,
	snapshot whiteboardSvc.WhiteboardSceneSnapshot,
) error {
	message := whiteboardSvc.NewWhiteboardSceneSyncMessage(snapshot)
	payload, err := json.Marshal(message)
	if err != nil {
		return err
	}
	return writeWhiteboardScenePayload(conn, writeMu, payload)
}

func writeWhiteboardSceneError(conn *websocket.Conn, writeMu *sync.Mutex, code string) error {
	payload, err := json.Marshal(whiteboardSvc.NewWhiteboardSceneErrorMessage(code))
	if err != nil {
		return err
	}
	return writeWhiteboardScenePayload(conn, writeMu, payload)
}

func writeWhiteboardScenePayload(conn *websocket.Conn, writeMu *sync.Mutex, payload []byte) error {
	writeMu.Lock()
	defer writeMu.Unlock()
	return conn.WriteMessage(websocket.TextMessage, payload)
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
	if err != nil {
		return err
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

	presenceRecord := whiteboardSvc.CursorPresenceRecord{
		ConnectionID: connectionID,
		User:         mapWhiteboardCursorUser(currentUser),
		Cursor:       whiteboardSvc.CursorPosition{},
		UpdatedAt:    time.Now().UTC(),
	}

	if err := h.presenceStore.PutConnection(redisCtx, session.ProjectID, presenceRecord); err != nil {
		slog.Error("failed to store whiteboard cursor presence", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		return nil
	}
	if err := h.presenceStore.PublishSnapshot(redisCtx, session.ProjectID); err != nil {
		slog.Error("failed to publish whiteboard cursor snapshot", "error", err, "projectID", session.ProjectID)
		return nil
	}

	errCh := make(chan error, 2)
	go h.forwardWhiteboardCursorSnapshots(channel, conn, session.Expiry, errCh)
	go h.consumeWhiteboardCursorUpdates(redisCtx, conn, session.ProjectID, presenceRecord, session.Expiry, errCh)

	firstErr := <-errCh
	cancel()
	closeSub()
	closeConn()
	secondErr := <-errCh

	if err := h.presenceStore.RemoveConnection(context.Background(), session.ProjectID, connectionID); err != nil {
		slog.Error("failed to remove whiteboard cursor presence", "error", err, "projectID", session.ProjectID, "connectionID", connectionID)
	} else if err := h.presenceStore.PublishSnapshot(context.Background(), session.ProjectID); err != nil {
		slog.Error("failed to publish whiteboard cursor snapshot after disconnect", "error", err, "projectID", session.ProjectID)
	}

	for _, runErr := range []error{firstErr, secondErr} {
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
	expiry time.Time,
	errCh chan<- error,
) {
	for msg := range channel {
		if !expiry.IsZero() && expiry.Before(time.Now()) {
			errCh <- websocket.ErrCloseSent
			return
		}

		if err := conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
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
	presenceRecord whiteboardSvc.CursorPresenceRecord,
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
		presenceRecord.UpdatedAt = time.Now().UTC()
		if err := h.presenceStore.PutConnection(ctx, projectID, presenceRecord); err != nil {
			errCh <- err
			return
		}
		if err := h.presenceStore.PublishSnapshot(ctx, projectID); err != nil {
			errCh <- err
			return
		}
	}
}
