package websocket

import (
	"backend/routes"
	"backend/services/auth"
	"backend/services/project"
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type projectWSRouteHandler struct {
	authService    auth.AuthService
	projectService project.ProjectService
	upgrader       websocket.Upgrader
	rdb            *redis.Client
	hubs           *ProjectHubRegistry
}

type taskWSUpdateResponse struct { //nolint:unused
	Type    int `json:"type" example:"3"`
	Payload any `json:"payload"`
}

type chatWSUpdateResponse struct { //nolint:unused
	Type    int `json:"type" example:"0"`
	Payload any `json:"payload"`
}

func newProjectWSRouteHandler(authService auth.AuthService, projectService project.ProjectService, rdb *redis.Client, hubs *ProjectHubRegistry) projectWSRouteHandler {
	return projectWSRouteHandler{
		authService:    authService,
		projectService: projectService,
		rdb:            rdb,
		hubs:           hubs,
		upgrader:       newWSUpgrader(),
	}
}

func (h projectWSRouteHandler) addRoutes(ws *echo.Group) {
	g := ws.Group("/project/:projectId", h.authService.AuthenticatedMiddleware())
	g.GET("/chat", h.connectChatGET)
	g.GET("/messages", h.connectChatGET)
	g.GET("/tasks", h.connectTasksGET)
	g.GET("/kanban", h.connectTasksGET)
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
//	@Description	Upgrades HTTP connection to WebSocket. After successful handshake, server sends JSON task and project update envelopes with a numeric type and a payload.
//	@Description	Payload depends on the event type: TaskCreate and TaskUpdate send Task, TaskDelete sends an object with deletedTaskID, TaskMove sends an array of Task, TaskAssign sends TaskAssignee, and TaskUnassign sends an object with taskID and projectMemberID.
//	@Tags		task
//	@Param		projectId	path		string	true	"Project ID"
//	@Success	101		{object}	taskWSUpdateResponse	"Switching Protocols. Subsequent WebSocket text frames contain task update envelopes."
//	@Failure	400		{object}	routes.ErrorResponse	"invalid project id"
//	@Failure	401		{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	500		{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/ws/project/{projectId}/tasks [get]
//	@Router		/ws/project/{projectId}/kanban [get]
func (h projectWSRouteHandler) connectTasksGET(c *echo.Context) error {
	return h.connectProjectHubGET(c, "tasks", isTasksPageWSEventType)
}

func isTasksPageWSEventType(t routes.WSMessageType) bool {
	return isTaskWSEventType(t) || isProjectWSEventType(t)
}

// GET /ws/project/:projectId/chat
//
//	@Summary	Connect to chat updates websocket
//	@Description	Upgrades HTTP connection to WebSocket. After successful handshake, server sends JSON chat and project update envelopes with a numeric type and a payload.
//	@Description	Chat payloads currently contain message identifiers. Clients should refetch durable chat data after receiving chat create, update, or delete events.
//	@Tags		chat
//	@Param		projectId	path		string	true	"Project ID"
//	@Success	101		{object}	chatWSUpdateResponse	"Switching Protocols. Subsequent WebSocket text frames contain chat update envelopes."
//	@Failure	400		{object}	routes.ErrorResponse	"invalid project id"
//	@Failure	401		{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	500		{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/ws/project/{projectId}/chat [get]
//	@Router		/ws/project/{projectId}/messages [get]
func (h projectWSRouteHandler) connectChatGET(c *echo.Context) error {
	return h.connectProjectHubGET(c, "chat", isChatPageWSEventType)
}

func isChatPageWSEventType(t routes.WSMessageType) bool {
	return isChatWSEventType(t) || isProjectWSEventType(t)
}

func (h projectWSRouteHandler) connectProjectHubGET(
	c *echo.Context,
	endpointName string,
	filter HubMessageFilter,
) error {
	ctx := c.Request().Context()
	session, err := authorizeProjectWSSession(c, h.authService, h.projectService)
	if err != nil || session == nil {
		return err
	}

	if h.hubs == nil {
		slog.Error(endpointName+" websocket missing project hub registry", "projectID", session.ProjectID, "userID", session.UserID)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "internal server error"})
	}

	sub, err := h.hubs.Attach(ctx, session.ProjectID)
	if err != nil {
		slog.Error("failed to attach "+endpointName+" websocket to project hub", "error", err, "projectID", session.ProjectID, "userID", session.UserID)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "internal server error"})
	}
	defer sub.Detach()

	ws, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade "+endpointName+" websocket", "error", err)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	defer func() {
		if err := ws.Close(); err != nil {
			slog.Error("failed to close "+endpointName+" websocket connection", "error", err)
		}
	}()

	ws.SetReadLimit(wsMaxMessageSize)
	if err := ws.SetReadDeadline(time.Now().Add(wsPongWait)); err != nil {
		slog.Error("failed to set "+endpointName+" read deadline", "error", err)
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
	go forwardFilteredHubMessages(sub.Messages, ws, &writeMu, session.Expiry, filter, errCh)

	runErr := <-errCh
	if runErr != nil && !websocket.IsCloseError(runErr, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		slog.Debug(endpointName+" ws closed", "error", runErr, "user-id", session.UserID)
	}
	return nil
}
