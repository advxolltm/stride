package routes

import (
	"backend/services/auth"
	"backend/services/example"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
)

type exampleRouteHandler struct {
	exampleService example.ExampleService
	authService    auth.AuthService
}

func NewExampleRouteHandler(exampleService example.ExampleService, authService auth.AuthService) *exampleRouteHandler {
	return &exampleRouteHandler{
		exampleService,
		authService,
	}
}

// The RouteHandler interface is implicitly implemented by "adding" this function to the struct
func (h exampleRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/example")
	g.GET("/data", h.dataGETHandle)
	g.GET("/data-protected", h.dataProtectedGETHandle, h.authService.AuthenticatedMiddleware())
}

func (h exampleRouteHandler) dataGETHandle(c *echo.Context) error {
	value, err := h.exampleService.GetData()
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Errorf("you are using the application wrong >:( -> error: %w", err).Error())
	}
	return c.String(http.StatusOK, value)
}

func (h exampleRouteHandler) dataProtectedGETHandle(c *echo.Context) error {
	claims := h.authService.GetClaims(c)
	userID := claims.UserID

	value, err := h.exampleService.GetData()
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Errorf("you are using the application wrong >:( -> error: %w", err).Error())
	}
	return c.String(http.StatusOK, fmt.Sprintf("Hello user %s! -> %s", userID.String(), value))
}
