package main

import (
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	// NOTE: if you want to give multiple "layers" (route, service, db) the same package-name to group them together, you can provide a custom name on import to distinguish them like here
	exampleDB "backend/db/example"
	"backend/routes"
	exampleService "backend/services/example"
)

func main() {
	e := echo.New()
	e.Use(middleware.RequestLogger())

	// NOTE: no automatic magic dependency injection
	//		 we define everything we need here once and then just pass it to the handlers as necessary
	// Stores
	exampleStore := exampleDB.NewExampleStore("some-db-connection-string")

	// Services
	exampleService := exampleService.NewExampleService(exampleStore)

	// Routes
	// Register route handler by adding them to the array
	handlers := []routes.RouteHandler{
		routes.NewExampleRouteHandler(exampleService),
	}

	for _, handler := range handlers {
		handler.AddRoutes(e)
	}

	if err := e.Start(":1323"); err != nil {
		e.Logger.Error("failed to start server", "error", err)
	}
}
