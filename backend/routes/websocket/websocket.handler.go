package websocket

import (
	"backend/services/auth"
	"backend/services/project"
	"backend/services/user"

	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type WSRouteHandler struct {
	projectHandler      projectWSRouteHandler
	notificationHandler notificationWSRouteHandler
	whiteboardHandler   whiteboardWSRouteHandler
}

func NewWSRouteHandler(
	authService auth.AuthService,
	projectService project.ProjectService,
	userService user.UserService,
	rdb *redis.Client,
) *WSRouteHandler {
	hubs := NewProjectHubRegistry(rdb)
	return &WSRouteHandler{
		projectHandler:      newProjectWSRouteHandler(authService, projectService, rdb, hubs),
		notificationHandler: newNotificationWSRouteHandler(authService, rdb),
		whiteboardHandler:   newWhiteboardWSRouteHandler(authService, projectService, userService, rdb, hubs),
	}
}

func (h WSRouteHandler) AddRoutes(ws *echo.Group) {
	wsGroup := ws.Group("/ws")

	h.projectHandler.addRoutes(wsGroup)
	h.notificationHandler.addRoutes(wsGroup)
	h.whiteboardHandler.addRoutes(wsGroup)
}
