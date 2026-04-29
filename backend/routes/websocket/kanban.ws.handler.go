package websocket

import (
	"backend/services/auth"
	"net/http"

	"github.com/labstack/echo/v5"
)

type kanbanWSRouteHandler struct {
	authService auth.AuthService
}

func newKanbanWSRouteHandler(authService auth.AuthService) kanbanWSRouteHandler {
	return kanbanWSRouteHandler{authService: authService}
}

func (h kanbanWSRouteHandler) addRoutes(ws *echo.Group) {
	g := ws.Group("/project/:projectId/kanban", h.authService.AuthenticatedMiddleware())
	g.GET("", h.connectGET)
}

func (h kanbanWSRouteHandler) connectGET(c *echo.Context) error {
	return c.NoContent(http.StatusNotImplemented)
}