package routes

import (
	"backend/services/auth"
	"backend/services/example"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
)

type ExampleRouteHandler struct {
	exampleService example.ExampleService
	authService    auth.AuthService
}

func NewExampleRouteHandler(exampleService example.ExampleService, authService auth.AuthService) *ExampleRouteHandler {
	return &ExampleRouteHandler{
		exampleService,
		authService,
	}
}

// The RouteHandler interface is implicitly implemented by "adding" this function to the struct
func (h ExampleRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/example")
	g.GET("/data", h.DataGETHandle)
	g.GET("/data-protected", h.DataProtectedGETHandle, h.authService.AuthenticatedMiddleware())
}

//	@Summary	Some route to get data
//	@Tags		example
//	@Success	200	{object}	routes.DataGETHandle.dataResponse
//	@Router		/example/data [get]
func (h ExampleRouteHandler) DataGETHandle(c *echo.Context) error {
	type dataResponse struct {
		Value string
	}
	value, err := h.exampleService.GetData()
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Errorf("you are using the application wrong >:( -> error: %w", err).Error())
	}
	return c.JSON(http.StatusOK, dataResponse{Value: value})
}

//	@Summary	Some route to get data, requires authentication
//	@Tags		example
//	@Success	200	{string}	string
//	@Router		/example/data-protected [get]
//	@Security	Auth
func (h ExampleRouteHandler) DataProtectedGETHandle(c *echo.Context) error {
	claims := h.authService.GetClaims(c)
	userID := claims.UserID

	value, err := h.exampleService.GetData()
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Errorf("you are using the application wrong >:( -> error: %w", err).Error())
	}
	return c.String(http.StatusOK, fmt.Sprintf("Hello user %s! -> %s", userID.String(), value))
}
