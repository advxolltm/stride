package websocket

import (
	"backend/services/auth"
	"net/http"

	"github.com/labstack/echo/v5"
)

type chatWSRouteHandler struct {
	authService auth.AuthService
}

func newChatWSRouteHandler(authService auth.AuthService) chatWSRouteHandler {
	return chatWSRouteHandler{authService: authService}
}

func (h chatWSRouteHandler) addRoutes(ws *echo.Group) {
	g := ws.Group("/project/:projectId/chat", h.authService.AuthenticatedMiddleware())
	g.GET("", h.connectGET)
}

func (h chatWSRouteHandler) connectGET(c *echo.Context) error {
	return c.NoContent(http.StatusNotImplemented)
}