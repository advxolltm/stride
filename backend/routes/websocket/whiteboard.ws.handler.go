package websocket

import (
	"backend/services/auth"
	"backend/services/project"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type whiteboardWSRouteHandler struct {
	authService auth.AuthService
	projectService project.ProjectService
	upgrader       websocket.Upgrader
	rdb            *redis.Client
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