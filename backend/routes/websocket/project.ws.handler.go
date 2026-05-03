package websocket

import (
	"backend/routes"
	"backend/services/auth"
	"backend/services/project"
	"log/slog"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type projectWSRouteHandler struct {
	authService    auth.AuthService
	projectService project.ProjectService
	upgrader       websocket.Upgrader
	rdb            *redis.Client
}

type taskWSUpdateResponse struct {
	Type    int `json:"type" example:"2"`
	Payload any `json:"payload"`
}

func newProjectWSRouteHandler(authService auth.AuthService, projectService project.ProjectService, rdb *redis.Client) projectWSRouteHandler {
	return projectWSRouteHandler{
		authService:    authService,
		projectService: projectService,
		rdb:            rdb,
		upgrader:       newWSUpgrader(),
	}
}

func (h projectWSRouteHandler) addRoutes(ws *echo.Group) {
	g := ws.Group("/project/:projectId", h.authService.AuthenticatedMiddleware())
	g.GET("/messages", h.connectMessagesGET)
	g.GET("/kanban", h.connectKanbanGET)
}

func consumeProjectWSDisconnect(conn *websocket.Conn, errCh chan<- error) {
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			errCh <- err
			return
		}
	}
}

// GET /ws/project/:projectId/tasks
//
//	@Summary	Connect to task updates websocket
//	@Description	Upgrades HTTP connection to WebSocket. After successful handshake, server sends JSON task update envelopes with a numeric type and a payload.
//	@Description	Payload depends on the event type: TaskCreate and TaskUpdate send Task, TaskDelete sends an object with deletedTaskID, TaskMove sends an array of Task, TaskAssign sends TaskAssignee, and TaskUnassign sends an object with taskID and projectMemberID.
//	@Tags		task
//	@Param		projectId	path		string	true	"Project ID"
//	@Success	101		{object}	taskWSUpdateResponse	"Switching Protocols. Subsequent WebSocket text frames contain task update envelopes."
//	@Failure	400		{object}	routes.ErrorResponse	"invalid project id"
//	@Failure	401		{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	500		{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/ws/project/{projectId}/tasks [get]
func (h projectWSRouteHandler) connectKanbanGET(c *echo.Context) error {
	ctx := c.Request().Context()
	session, err := authorizeProjectWSSession(c, h.authService, h.projectService)
	if err != nil {
		return err
	}

	ws, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade", "error", err)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	defer func() {
		err := ws.Close()
		if err != nil {
			slog.Error("failed to close websocket connection", "error", err)
		}
	}()

	sub := h.rdb.Subscribe(ctx, session.ProjectID.String())
	defer func() {
		err := sub.Close()
		if err != nil {
			slog.Error("failed to close redis sub", "error", err)
		}
	}()
	ch := sub.Channel()
	disconnectCh := make(chan error, 1)

	go consumeProjectWSDisconnect(ws, disconnectCh)

	for {
		select {
		case err := <-disconnectCh:
			if err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				slog.Debug("project ws closed", "error", err, "user-id", session.UserID)
			}
			return nil
		case msg, ok := <-ch:
			if !ok {
				return nil
			}

			if isWSSessionExpired(session.Expiry) {
				slog.Debug("Client session expired, closing ws connection", "user-id", session.UserID)
				return nil
			}

			if err := ws.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
				slog.Debug("project ws write failed, closing connection", "error", err, "user-id", session.UserID)
				return nil
			}
		}
	}
}

func (h projectWSRouteHandler) connectMessagesGET(c *echo.Context) error {
	return c.NoContent(http.StatusNotImplemented)
}