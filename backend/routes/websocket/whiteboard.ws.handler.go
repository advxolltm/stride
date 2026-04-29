package websocket

import (
	"backend/services/auth"
	"net/http"

	"github.com/labstack/echo/v5"
)

type whiteboardWSRouteHandler struct {
	authService auth.AuthService
}

func newWhiteboardWSRouteHandler(authService auth.AuthService) whiteboardWSRouteHandler {
	return whiteboardWSRouteHandler{authService: authService}
}

func (h whiteboardWSRouteHandler) addRoutes(ws *echo.Group) {
	g := ws.Group("/project/:projectId/whiteboard", h.authService.AuthenticatedMiddleware())
	g.GET("", h.connectGET)
	g.GET("/cursor", h.cursorConnectGET)
}

func (h whiteboardWSRouteHandler) connectGET(c *echo.Context) error {
	return c.NoContent(http.StatusNotImplemented)
}

func (h whiteboardWSRouteHandler) cursorConnectGET(c *echo.Context) error {
	return c.NoContent(http.StatusNotImplemented)
}