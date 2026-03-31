package routes

import (
	"backend/services/example"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
)

type exampleRouteHandler struct {
	exampleService example.ExampleService
}

func NewExampleRouteHandler(exampleService example.ExampleService) *exampleRouteHandler {
	return &exampleRouteHandler{
		exampleService,
	}
}

// The RouteHandler interface is implicitly implemented by "adding" this function to the struct
func (h exampleRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/example")
	g.GET("/data", h.dataGETHandle)
}

func (h exampleRouteHandler) dataGETHandle(c *echo.Context) error {
	value, err := h.exampleService.GetData()
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Errorf("you are using the application wrong >:( -> error: %w", err).Error())
	}
	return c.String(http.StatusOK, value)
}
