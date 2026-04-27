package routes

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

type healthRouteHandler struct{}

func NewHealthRouteHandler() *healthRouteHandler {
	return &healthRouteHandler{}
}

func (h healthRouteHandler) AddRoutes(api *echo.Group) {
	api.GET("/health", h.healthGETHandle)
}

func (h healthRouteHandler) healthGETHandle(c *echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
