package websocket

import (
	"backend/routes"
	"backend/services/auth"
	"backend/services/project"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)



type projectWSRouteHandler struct {
	authService auth.AuthService
	projectService project.ProjectService
	upgrader       websocket.Upgrader
	rdb            *redis.Client
}

func newProjectWSRouteHandler(authService auth.AuthService, projectService project.ProjectService, rdb *redis.Client) projectWSRouteHandler {
	return projectWSRouteHandler{
		authService:    authService,
		projectService: projectService,
		rdb:            rdb,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (h projectWSRouteHandler) addRoutes(ws *echo.Group) {
	g := ws.Group("/project/:projectId", h.authService.AuthenticatedMiddleware())
	g.GET("", h.connectGET)
}

func (h projectWSRouteHandler) connectGET(c *echo.Context) error {
	ctx := c.Request().Context()
	channel, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}
	claims := h.authService.GetClaims(c)
	expiry := claims.ExpiresAt.Time

	isProjectMember, err := h.projectService.IsProjectMember(ctx, claims.UserID, channel)
	if !isProjectMember || err != nil {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	ws, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade", "error", err)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	defer ws.Close()

	sub := h.rdb.Subscribe(ctx, channel.String())
	defer sub.Close()
	ch := sub.Channel()

	for msg := range ch {
		if expiry.Before(time.Now()) {
			slog.Debug("Client session expired, closing ws connection", "userid", claims.UserID)
			break
		}

		if err := ws.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
			slog.Error("Write error", "error", err)
		}
	}

	slog.Debug("Closing ws connection", "userid", claims.UserID)
	return nil
}
