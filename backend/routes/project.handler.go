package routes

import (
	"errors"
	"net/http"

	authService "backend/services/auth"
	projectService "backend/services/project"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

// TODO: Tests user.handler.go
type projectRouteHandler struct {
	projectService projectService.ProjectService
	authService    authService.AuthService
}

func NewProjectRouteHandler(ps projectService.ProjectService, as authService.AuthService) *projectRouteHandler {
	return &projectRouteHandler{projectService: ps, authService: as}
}

func (h projectRouteHandler) AddRoutes(api *echo.Group) {
	// TODO: add auth middleware
	g := api.Group("/projects")
	g.Use(h.authService.AuthenticatedMiddleware())
	g.GET("", h.projectsGETHandle)
	g.GET("/:id", h.projectGETHandle)
	g.GET("/:id/members", h.membersGETHandle)
	g.GET("/:id/skills", h.skillsGETHandle)
	g.POST("", h.projectPOSTHandle)
	g.POST("/:id/members", h.memberPOSTHandle)
	g.POST("/:id/skills", h.skillsPOSTHandle)
	g.DELETE("/:id/members/:userid", h.memberDELETEHandle)
	g.DELETE("/skills/:id", h.skillsDELETEHandle)
	g.PATCH("/:id", h.projectPATCHHandle)
	g.DELETE("/:id", h.projectDELETEHandle)
}

type CreateProjectRequest struct { // createdBy *uuid.UUID, name string, slug string, description *string, status string
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type createSkillRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
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
//	@Tags		project
//	@Success	200	{object}	[]returnProj
//	@Failure	404	{object}	ErrorResponse "project not found"
//	@Failure	401 {object}	ErrorResponse "internal server error"
//	@Router		/projects [get]
func (h projectRouteHandler) projectsGETHandle(c *echo.Context) error {
	// TODO: add user-check
	userid := h.authService.GetClaims(c).UserID

	projects, err := h.projectService.GetAllProjects(c.Request().Context(), &userid)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, Map(projects, mapToReturnProj))
}

// GET /projects/:id
//
// @Summary Get a project by its ID
// @Param id path string true "Project ID"
// @Success	200	{object}	returnProj
// @Failure	404	{object}	ErrorResponse "project not found"
// @Failure	401 {object}	ErrorResponse "internal server error"
// @Router /projects/{id} [get]
func (h projectRouteHandler) projectGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	// TODO: add user-check - only admin and user himself can retrieve data

	p, err := h.projectService.GetProject(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, mapToReturnProj(*p))
}

// GET /projects:id/members
func (h projectRouteHandler) membersGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	// TODO: add user-check

	members, err := h.projectService.GetProjectMembers(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, Map(members, mapToReturnMember))
}

// GET /projects:id/skills
func (h projectRouteHandler) skillsGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	// TODO: add user-check

	skills, err := h.projectService.GetProjectSkills(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, skills)
}

// POST /projects
func (h projectRouteHandler) projectPOSTHandle(c *echo.Context) error {
	var req CreateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	userId := h.authService.GetClaims(c).UserID

	//createdBy *uuid.UUID, name string, slug string, description *string, status string
	p, err := h.projectService.CreateProject(c.Request().Context(), &userId, req.Name, req.Slug, req.Description, req.Status)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, mapToReturnProj(*p))
}

// POST /projects/:id/members
func (h projectRouteHandler) memberPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}
	var req []projectService.AddMemberRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	u, err := h.projectService.AddUsersToProject(c.Request().Context(), req, id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, Map(u, mapToReturnMemberP))

}

func (h projectRouteHandler) skillsPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	var req createSkillRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	s, err := h.projectService.AddProjectSkill(c.Request().Context(), id, req.Name, req.Description)

	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, s)
}

// @Summary	Change general project data. Must be project owner.
// @Tags		projects
// @Param		id	path	string	true	"Project ID"
// @Success	200
// @Failure	400	{object}	ErrorResponse	"invalid project id"
// @Failure	401	{object}	ErrorResponse	"unauthorized"
// @Router		/projects/{id} [patch]
func (h projectRouteHandler) projectPATCHHandle(c *echo.Context) error {
	ctx := c.Request().Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.authService.IsProjectOwner(ctx, userId, id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	if !isOwner {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	var req updateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	p, err := h.projectService.UpdateProject(ctx, id, projectService.UpdateProjectInput{
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		Status:      req.Status,
	})
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, mapToReturnProj(*p))
}

// DELETE /projects/:id
func (h projectRouteHandler) projectDELETEHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	if err := h.projectService.DeleteProject(c.Request().Context(), id); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}

// DELETE /projects/:id/members/:userid
func (h projectRouteHandler) memberDELETEHandle(c *echo.Context) error {
	projid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}
	userid, err := uuid.Parse(c.Param("userid"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	// TODO: ONLY PROJECT OWNER CAN REMOVE USERS
	if err := h.projectService.RemoveUserFromProject(c.Request().Context(), userid, projid); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)

}

// DELETE /projects/:id/skills/:skillid
func (h projectRouteHandler) skillsDELETEHandle(c *echo.Context) error {
	skillid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid skill id"})
	}

	if err := h.projectService.RemoveProjectSkill(c.Request().Context(), skillid); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}
