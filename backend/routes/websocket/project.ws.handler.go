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
	g.GET("", h.connectGET)
}

func (h projectWSRouteHandler) connectGET(c *echo.Context) error {
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
	defer ws.Close()

	sub := h.rdb.Subscribe(ctx, session.ProjectID.String())
	defer sub.Close()
	ch := sub.Channel()

	for msg := range ch {
		if isWSSessionExpired(session.Expiry) {
			slog.Debug("Client session expired, closing ws connection", "userid", session.UserID)
			break
		}

		if err := ws.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
			slog.Error("Write error", "error", err)
		}
	}

	slog.Debug("Closing ws connection", "userid", session.UserID)
	return nil
}
