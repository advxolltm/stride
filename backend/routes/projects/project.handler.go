package projects

import (
	"errors"
	"net/http"

	"backend/routes"
	authService "backend/services/auth"
	projectService "backend/services/project"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type projectRouteHandler struct {
	projectService projectService.ProjectService
	authService    authService.AuthService
}

func newProjectRouteHandler(ps projectService.ProjectService, as authService.AuthService) *projectRouteHandler {
	return &projectRouteHandler{projectService: ps, authService: as}
}

func (h *projectRouteHandler) registerRoutes(g *echo.Group) {
	g.GET("", h.projectsGETHandle)
	g.GET("/:id", h.projectGETHandle)
	g.GET("/:id/members", h.membersGETHandle)
	g.POST("", h.projectPOSTHandle)
	g.POST("/:id/members", h.memberPOSTHandle)
	g.PATCH("/:id", h.projectPATCHHandle)
	g.DELETE("/:id", h.projectDELETEHandle)
	g.DELETE("/:id/members/:userid", h.memberDELETEHandle)
}

type createProjectRequest struct {
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type addMemberRequest struct {
	UserId uuid.UUID `json:"userid"`
	Role   string    `json:"role"`
}

type updateProjectRequest struct {
	Name        *string `json:"name"`
	Slug        *string `json:"slug"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

func mapServiceErrorProj(err error) (int, string) {
	switch {
	case errors.Is(err, projectService.ErrProjectNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrDuplicateSlug):
		return http.StatusConflict, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

// GET /projects
//
//	@Summary	Get all projects for the authenticated user
//	@Success	200	{object}	any
//	@Router		/projects [get]
func (h *projectRouteHandler) projectsGETHandle(c *echo.Context) error {
	projects, err := h.projectService.GetAllProjects(c.Request().Context())
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, projects)
}

// GET /projects/:id
func (h *projectRouteHandler) projectGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	p, err := h.projectService.GetProject(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, p)
}

// GET /projects/:id/members
func (h *projectRouteHandler) membersGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	members, err := h.projectService.GetProjectMembers(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, members)
}

// POST /projects
func (h *projectRouteHandler) projectPOSTHandle(c *echo.Context) error {
	var req createProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	userId := h.authService.GetClaims(c).UserID

	p, err := h.projectService.CreateProject(c.Request().Context(), &userId, req.Name, req.Slug, req.Description, req.Status)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, p)
}

// POST /projects/:id/members
func (h *projectRouteHandler) memberPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	var req addMemberRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	p, err := h.projectService.AddUserToProject(c.Request().Context(), req.UserId, id, req.Role)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, p)
}

//	@Summary	Change general project data. Must be project owner.
//	@Tags		projects
//	@Param		id	path	string	true	"Project ID"
//	@Success	200
//	@Failure	400	{object}	routes.ErrorResponse	"invalid project id"
//	@Failure	401	{object}	routes.ErrorResponse	"unauthorized"
//	@Router		/projects/{id} [patch]
func (h *projectRouteHandler) projectPATCHHandle(c *echo.Context) error {
	ctx := c.Request().Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectOwner(ctx, userId, id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	var req updateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	p, err := h.projectService.UpdateProject(ctx, id, projectService.UpdateProjectInput{
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		Status:      req.Status,
	})
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, p)
}

// DELETE /projects/:id
func (h *projectRouteHandler) projectDELETEHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	if err := h.projectService.DeleteProject(c.Request().Context(), id); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}

// DELETE /projects/:id/members/:userid
func (h *projectRouteHandler) memberDELETEHandle(c *echo.Context) error {
	projid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}
	userid, err := uuid.Parse(c.Param("userid"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid user id"})
	}

	// TODO: ONLY PROJECT OWNER CAN REMOVE USERS
	if err := h.projectService.RemoveUserFromProject(c.Request().Context(), userid, projid); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}
