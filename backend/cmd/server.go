package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	// NOTE: if you want to give multiple "layers" (route, service, db) the same package-name to group them together, you can provide a custom name on import to distinguish them like here
	mainDB "backend/db"
	exampleDB "backend/db/example"
	userDB "backend/db/user"
	"backend/routes"
	authService "backend/services/auth"
	exampleService "backend/services/example"
	userService "backend/services/user"
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

	// NOTE: No automatic magic dependency injection
	//		 We define everything we need here once and then just pass it to the handlers as necessary Stores
	exampleStore := exampleDB.NewExampleStore("some-db-connection-string")

	var migration *migrate.Migrate
	dsn := fmt.Sprintf(
		"postgresql://%s:%s@%s:%s/%s?sslmode=disable",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)

	mainDB, migration, err := mainDB.InitDB(dsn)
	defer migration.Down()

	if err != nil {
		println("failed to initialize database", "error", err)
	}
	println("Database initialized successfully:", mainDB != nil)

	userStore := userDB.NewUserStore(mainDB)

	// Services
	exampleService := exampleService.NewExampleService(exampleStore)
	userService := userService.NewUserService(userStore)
	authService := authService.NewAuthenticationService(userService)

	// Routes
	// Register route handler by adding them to the array
	// NOTE: The authService provides a [AuthService.AuthenticatedMiddleware()] function
	//		 which returns a middleware that checks if a user is authenticated using jwt tokens.
	//		 In order to protect routes registered by a handler, pass the [authService] to the handler (see exampleRouteHandler).
	handlers := []routes.RouteHandler{
		routes.NewHealthRouteHandler(),
		routes.NewAuthRouteHandler(authService),
		routes.NewExampleRouteHandler(exampleService, authService),
		routes.NewUserRouteHandler(userService),
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
