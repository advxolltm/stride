package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/golang-migrate/migrate/v4"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	"gorm.io/gorm"

	// NOTE: if you want to give multiple "layers" (route, service, db) the same package-name to group them together, you can provide a custom name on import to distinguish them like here
	"backend/db"
	chatStore "backend/db/chat"
	notificationDB "backend/db/notification"
	projectDB "backend/db/project"
	taskDB "backend/db/task"
	userDB "backend/db/user"
	whiteboardDB "backend/db/whiteboard"
	"backend/routes"
	"backend/routes/projects"
	taskHandler "backend/routes/task"
	wsRoutes "backend/routes/websocket"
	authService "backend/services/auth"
	chatService "backend/services/chat"
	notificationService "backend/services/notification"
	projectService "backend/services/project"
	schedulerService "backend/services/scheduler"
	taskService "backend/services/task"
	userService "backend/services/user"
	whiteboardService "backend/services/whiteboard"
	"backend/testutils"

	//"backend/docs"

	echoSwagger "github.com/swaggo/echo-swagger/v2"
	"github.com/swaggo/swag/example/basic/docs"
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

func envEnabled(name string) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(name)))
	return value == "1" || value == "true" || value == "yes" || value == "on"
}

func closeMigration(migration *migrate.Migrate) {
	if migration == nil {
		return
	}

	srcErr, dbErr := migration.Close()
	if srcErr != nil || dbErr != nil {
		println("failed to close migration", "source_error", srcErr, "db_error", dbErr)
	}
}

func initMainDB(dsn string) (*gorm.DB, error) {
	if !envEnabled("RUN_DB_MIGRATIONS") {
		return db.InitGORMDB(dsn)
	}

	mainDB, migration, err := db.InitDB(dsn)
	if err != nil {
		return nil, err
	}
	closeMigration(migration)
	testutils.SeedDB(mainDB)

	return mainDB, nil
}

//	@title		STRIDE backend API
//	@version	1.0

//	@license.name	MIT
//	@license.url	https://mit-license.org/

//	@host	localhost:8000

//	@securityDefinitions.bearerauth	Auth
//	@description					Authentication via Bearer JWT. Since authentication works using cookies, simply use the /auth/login route to authenticate for subsequent requests!
//	@bearerformat					JWT

// @securityDefinitions.apikey	Auth
// @in							cookie
// @name						sessionToken
// @description				DO NOT USE THIS, AUTHENTICATION HAPPENS AUTOMATICALLY (this is just needed to correctly generate the swagger ui config!)
func main() {
	e := echo.New()
	e.Use(middleware.RequestLogger())

	apiGroup := e.Group(getAPIBasePath())
	docs.SwaggerInfo.BasePath = getAPIBasePath()

	// NOTE: No automatic magic dependency injection
	//		 We define everything we need here once and then just pass it to the handlers as necessary Stores
	dsn := db.PostgresDSNFromEnv()

	mainDB, err := initMainDB(dsn)

	if err != nil {
		println("failed to initialize database", "error", err)
		return
	}

	if envEnabled("EXIT_AFTER_DB_SETUP") {
		return
	}

	rdb := db.InitRedis(db.RedisDSNFromEnv())
	defer func() {
		err := rdb.Close()
		if err != nil {
			slog.Error("failed to close redis client", "error", err)
		}
	}()

	userStore := userDB.NewUserStore(mainDB)
	projectStore := projectDB.NewProjectStore(mainDB)
	whiteboardStore := whiteboardDB.NewWhiteboardStore(mainDB)
	taskStore := taskDB.NewTaskStore(mainDB)
	notificationStore := notificationDB.NewNotificationStreamStore(rdb)
	chatStore := chatStore.NewChatStore(mainDB)

	// Services
	userService := userService.NewUserService(userStore)
	projectService := projectService.NewProjectService(projectStore)
	authService := authService.NewAuthenticationService(userService)
	whiteboardPendingStore := whiteboardDB.NewPendingElementStore(rdb)
	whiteboardFlusher := whiteboardService.NewFlusher(whiteboardPendingStore, mainDB, rdb)
	whiteboardService := whiteboardService.NewWhiteboardService(whiteboardStore, projectService, whiteboardPendingStore)
	taskService := taskService.NewTaskService(taskStore, projectService)
	notificationService := notificationService.NewNotificationService(notificationStore)
	chatService := chatService.NewChatService(chatStore)

	workerCtx, stopWorkers := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stopWorkers()
	go whiteboardFlusher.Run(workerCtx)
	schedService := schedulerService.NewSchedulerService(taskService, projectService)

	// Routes
	// Register route handler by adding them to the array
	// NOTE: The authService provides a [AuthService.AuthenticatedMiddleware()] function
	//		 which returns a middleware that checks if a user is authenticated using jwt tokens.
	//		 In order to protect routes registered by a handler, pass the [authService] to the handler (see exampleRouteHandler).
	handlers := []routes.RouteHandler{
		routes.NewHealthRouteHandler(),
		routes.NewAuthRouteHandler(authService, userService),
		projects.NewProjectsGroup(projectService, whiteboardService, chatService, notificationService, authService, rdb, schedService, taskService),
		taskHandler.NewTaskRouteHandler(authService, taskService, projectService, notificationService, rdb),
		routes.NewNotificationRouteHandler(notificationService, authService),
		routes.NewUserRouteHandler(userService, authService, projectService),
		wsRoutes.NewWSRouteHandler(authService, projectService, userService, rdb),
	}

	for _, handler := range handlers {
		handler.AddRoutes(apiGroup)
	}

	e.GET("/swagger/*", echoSwagger.EchoWrapHandlerV3(
		echoSwagger.PersistAuthorization(true),
	))

	port := os.Getenv("PORT")
	if port == "" {
		port = "1323"
	}

	if err := e.Start(":" + port); err != nil {
		e.Logger.Error("failed to start server", "error", err)
	}
}
