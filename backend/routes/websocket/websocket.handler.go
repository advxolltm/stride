package websocket

import (
	"backend/services/auth"
	"backend/services/project"

	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type WSRouteHandler struct {
	projectHandler      projectWSRouteHandler
	notificationHandler notificationWSRouteHandler
	whiteboardHandler   whiteboardWSRouteHandler
}

func NewWSRouteHandler(authService auth.AuthService, projectService project.ProjectService, rdb *redis.Client) *WSRouteHandler {
	return &WSRouteHandler{
		projectHandler:      newProjectWSRouteHandler(authService, projectService, rdb),
		notificationHandler: newNotificationWSRouteHandler(authService, projectService, rdb),
		whiteboardHandler:   newWhiteboardWSRouteHandler(authService),
	}
}

func (h WSRouteHandler) AddRoutes(ws *echo.Group) {
	wsGroup := ws.Group("/ws")

	h.projectHandler.addRoutes(wsGroup)
	h.notificationHandler.addRoutes(wsGroup)
	h.whiteboardHandler.addRoutes(wsGroup)
}
