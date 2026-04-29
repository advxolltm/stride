package websocket

import (
	"backend/services/auth"
	"backend/services/project"

	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type WSRouteHandler struct {
	chatHandler         chatWSRouteHandler
	kanbanHandler       kanbanWSRouteHandler
	notificationHandler notificationWSRouteHandler
	whiteboardHandler   whiteboardWSRouteHandler
}

func NewWSRouteHandler(authService auth.AuthService, _ project.ProjectService, _ *redis.Client) *WSRouteHandler {
	return &WSRouteHandler{
		chatHandler:         newChatWSRouteHandler(authService),
		kanbanHandler:       newKanbanWSRouteHandler(authService),
		notificationHandler: newNotificationWSRouteHandler(authService),
		whiteboardHandler:   newWhiteboardWSRouteHandler(authService),
	}
}

func (h WSRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/ws")
	h.chatHandler.addRoutes(g)
	h.kanbanHandler.addRoutes(g)
	h.notificationHandler.addRoutes(g)
	h.whiteboardHandler.addRoutes(g)
}
