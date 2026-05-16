package projects

import (
	"backend/routes"

	authService "backend/services/auth"
	chatService "backend/services/chat"
	notificationService "backend/services/notification"
	projectService "backend/services/project"
	whiteboardSvc "backend/services/whiteboard"

	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

// ProjectsGroup wires all /projects sub-handlers behind a single auth-protected group.
type ProjectsGroup struct {
	projectHandler    *projectRouteHandler
	skillsHandler     *skillsRouteHandler
	whiteboardHandler *whiteboardRouteHandler
	chatHandler       *chatRouteHandler
	authService       authService.AuthService
}

func NewProjectsGroup(
	ps projectService.ProjectService,
	ws whiteboardSvc.WhiteboardService,
	cs chatService.ChatService,
	ns notificationService.NotificationService,
	as authService.AuthService,
	rdb *redis.Client,
) *ProjectsGroup {
	return &ProjectsGroup{
		projectHandler:    newProjectRouteHandler(ps, ns, as, rdb),
		skillsHandler:     newSkillsRouteHandler(ps, as, rdb),
		whiteboardHandler: newWhiteboardRouteHandler(ws, as, rdb),
		chatHandler:       newChatRouteHandler(cs, as, ps, ns, rdb),
		authService:       as,
	}
}

// AddRoutes implements routes.RouteHandler.
func (pg *ProjectsGroup) AddRoutes(api *echo.Group) {
	g := api.Group("/projects")
	g.Use(pg.authService.AuthenticatedMiddleware())

	pg.projectHandler.registerRoutes(g)
	pg.skillsHandler.registerRoutes(g)
	pg.whiteboardHandler.registerRoutes(g)
	pg.chatHandler.registerRoutes(g)
}

// compile-time check
var _ routes.RouteHandler = (*ProjectsGroup)(nil)
