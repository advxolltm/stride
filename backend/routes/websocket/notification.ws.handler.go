package websocket

import (
	"backend/services/auth"
	"net/http"

	"github.com/labstack/echo/v5"
)

type notificationWSRouteHandler struct {
	authService auth.AuthService
}

func newNotificationWSRouteHandler(authService auth.AuthService) notificationWSRouteHandler {
	return notificationWSRouteHandler{authService: authService}
}

func (h notificationWSRouteHandler) addRoutes(ws *echo.Group) {
	g := ws.Group("/project/:projectId/notification", h.authService.AuthenticatedMiddleware())
	g.GET("", h.connectGET)
}

func (h notificationWSRouteHandler) connectGET(c *echo.Context) error {
	return c.NoContent(http.StatusNotImplemented)
}