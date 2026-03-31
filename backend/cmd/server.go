package main

import (
	"os"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	// NOTE: if you want to give multiple "layers" (route, service, db) the same package-name to group them together, you can provide a custom name on import to distinguish them like here
	exampleDB "backend/db/example"
	"backend/routes"
	exampleService "backend/services/example"
)

func getAPIBasePath() string {
	apiBasePath := strings.TrimSpace(os.Getenv("API_BASE_PATH"))
	if apiBasePath == "" {
		return "/api/v1"
	}

	if !strings.HasPrefix(apiBasePath, "/") {
		apiBasePath = "/" + apiBasePath
	}

	if len(apiBasePath) > 1 {
		apiBasePath = strings.TrimRight(apiBasePath, "/")
	}

	return apiBasePath
}

func main() {
	e := echo.New()
	e.Use(middleware.RequestLogger())
	apiGroup := e.Group(getAPIBasePath())

	// NOTE: no automatic magic dependency injection
	//		 we define everything we need here once and then just pass it to the handlers as necessary
	// Stores
	exampleStore := exampleDB.NewExampleStore("some-db-connection-string")

	// Services
	exampleService := exampleService.NewExampleService(exampleStore)

	// Routes
	// Register route handler by adding them to the array
	handlers := []routes.RouteHandler{
		routes.NewHealthRouteHandler(),
		routes.NewExampleRouteHandler(exampleService),
	}

	for _, handler := range handlers {
		handler.AddRoutes(apiGroup)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "1323"
	}

	if err := e.Start(":" + port); err != nil {
		e.Logger.Error("failed to start server", "error", err)
	}
}
