package projects

import (
	"backend/routes"

	authService "backend/services/auth"
	chatService "backend/services/chat"
	projectService "backend/services/project"
	whiteboardSvc "backend/services/whiteboard"

	"github.com/labstack/echo/v5"
)

// ProjectsGroup wires all /projects sub-handlers behind a single auth-protected group.
type ProjectsGroup struct {
	projectHandler    *projectRouteHandler
	skillsHandler     *skillsRouteHandler
	whiteboardHandler *whiteboardRouteHandler
	chatHandler		  *chatRouteHandler
	authService       authService.AuthService
}

func NewProjectsGroup(
	ps projectService.ProjectService,
	ws whiteboardSvc.WhiteboardService,
	cs chatService.ChatService,
	as authService.AuthService,
) *ProjectsGroup {
	return &ProjectsGroup{
		projectHandler:    newProjectRouteHandler(ps, as),
		skillsHandler:     newSkillsRouteHandler(ps, as),
		whiteboardHandler: newWhiteboardRouteHandler(ws),
		chatHandler:  newChatRouteHandler(cs, as, ps),
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
