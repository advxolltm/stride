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
	Type    int `json:"type" example:"13"`
	Payload any `json:"payload"`
}

type whiteboardWSMessageEnvelope struct {
	Type routes.WSMessageType `json:"type"`
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

func newWhiteboardWSRouteHandler(
	authService auth.AuthService,
	projectService project.ProjectService,
	userService user.UserService,
	rdb *redis.Client,
) whiteboardWSRouteHandler {
	return whiteboardWSRouteHandler{
		authService:    authService,
		projectService: projectService,
		userService:    userService,
		rdb:            rdb,
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

	if h.rdb == nil {
		slog.Error("whiteboard websocket missing redis client", "projectID", session.ProjectID, "userID", session.UserID)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "internal server error"})
	}

	sub := h.rdb.Subscribe(ctx, session.ProjectID.String())
	if _, err := sub.Receive(ctx); err != nil {
		slog.Error("failed to subscribe whiteboard websocket to redis", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "internal server error"})
	}
	defer func() {
		err := sub.Close()
		if err != nil {
			slog.Error("failed to close whiteboard redis sub", "error", err)
		}
	}()

	ws, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade whiteboard ws", "error", err)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	defer func() {
		err := ws.Close()
		if err != nil {
			slog.Error("failed to close whiteboard websocket connection", "error", err)
		}
	}()

	ch := sub.Channel()
	disconnectCh := make(chan error, 1)
	go h.consumeWhiteboardLiveClientMessages(
		ctx,
		ws,
		session.ProjectID,
		session.UserID,
		session.Expiry,
		disconnectCh,
	)

	for {
		select {
		case err := <-disconnectCh:
			if err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				slog.Debug("whiteboard ws closed", "error", err, "user-id", session.UserID)
			}
			return nil
		case msg, ok := <-ch:
			if !ok {
				return nil
			}

			if isWSSessionExpired(session.Expiry) {
				slog.Debug("Client session expired, closing whiteboard ws connection", "user-id", session.UserID)
				return nil
			}

			var envelope whiteboardWSMessageEnvelope
			if err := json.Unmarshal([]byte(msg.Payload), &envelope); err != nil {
				slog.Debug("ignored invalid whiteboard ws payload", "error", err)
				continue
			}

			if !isWhiteboardWSEventType(envelope.Type) {
				continue
			}

			if err := ws.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
				slog.Debug("whiteboard ws write failed, closing connection", "error", err, "user-id", session.UserID)
				return nil
			}
		}
	}
}

func isWhiteboardWSEventType(t routes.WSMessageType) bool {
	switch t {
	case routes.WhiteboardElementCreate,
		routes.WhiteboardElementUpdate,
		routes.WhiteboardElementDelete,
		routes.WhiteboardElementLiveUpdate,
		routes.WhiteboardElementLiveClear:
		return true
	default:
		return false
	}
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
	projectID uuid.UUID,
	userID uuid.UUID,
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

		messageType, clientID, operationID, parsedPayload, ok := parseWhiteboardLiveClientMessage(payload)
		if !ok {
			slog.Debug("ignored invalid whiteboard live client payload", "userID", userID)
			continue
		}

		meta := &routes.WSMessageMeta{
			OriginUserID: &userID,
			ClientID:     clientID,
			OperationID:  operationID,
		}

		if err := routes.SendWSUpdateWithMeta(
			ctx,
			h.rdb,
			projectID,
			messageType,
			meta,
			parsedPayload,
		); err != nil {
			errCh <- err
			return
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
