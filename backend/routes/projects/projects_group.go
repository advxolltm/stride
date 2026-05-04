package projects

import (
	"backend/routes"

	authService "backend/services/auth"
	projectService "backend/services/project"
	whiteboardSvc "backend/services/whiteboard"

	"github.com/labstack/echo/v5"
)

// ProjectsGroup wires all /projects sub-handlers behind a single auth-protected group.
type ProjectsGroup struct {
	projectHandler    *projectRouteHandler
	skillsHandler     *skillsRouteHandler
	whiteboardHandler *whiteboardRouteHandler
	authService       authService.AuthService
}

func NewProjectsGroup(
	ps projectService.ProjectService,
	ws whiteboardSvc.WhiteboardService,
	as authService.AuthService,
) *ProjectsGroup {
	return &ProjectsGroup{
		projectHandler:    newProjectRouteHandler(ps, as),
		skillsHandler:     newSkillsRouteHandler(ps, as),
		whiteboardHandler: newWhiteboardRouteHandler(ws, as),
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
}

// compile-time check
var _ routes.RouteHandler = (*ProjectsGroup)(nil)
