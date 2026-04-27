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

// CreateProjectRequest is the request body for creating a project.
type CreateProjectRequest struct {
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
} //	@name	CreateProjectRequest

type updateProjectRequest struct {
	Name        *string `json:"name"`
	Slug        *string `json:"slug"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
} //	@name	UpdateProjectRequest

// AddMemberRequest is the request body for adding a project member.
type AddMemberRequest struct {
	UserId uuid.UUID `json:"userid"`
	Role   string    `json:"role"`
} //	@name	AddMemberRequest

func mapServiceErrorProj(err error) (int, string) {
	switch {
	case errors.Is(err, projectService.ErrProjectNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrNonExistentUser):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrNonExistentMember):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrUserAlreadyMember):
		return http.StatusConflict, err.Error()
	case errors.Is(err, projectService.ErrNonExistentProjectSkill):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrDuplicateSlug):
		return http.StatusConflict, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

//	@Summary		Get all projects
//	@Description	Get all projects for the authenticated user
//	@Tags			projects
//	@Produce		json
//	@Success		200	{array}		routes.ReturnProj
//	@Failure		404	{object}	routes.ErrorResponse	"user not found"
//	@Failure		500	{object}	routes.ErrorResponse	"internal server error"
//	@Router			/projects [get]
func (h *projectRouteHandler) projectsGETHandle(c *echo.Context) error {
	userid := h.authService.GetClaims(c).UserID

	projects, err := h.projectService.GetAllProjects(c.Request().Context(), userid)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, routes.Map(projects, routes.MapToReturnProj))
}

//	@Summary		Get project by ID
//	@Description	Get a specific project's details including creator, members, and skills
//	@Tags			projects
//	@Produce		json
//	@Param			id	path		string	true	"Project ID"
//	@Success		200	{object}	routes.ReturnProj
//	@Failure		400	{object}	routes.ErrorResponse	"invalid project id"
//	@Failure		404	{object}	routes.ErrorResponse	"project not found"
//	@Failure		500	{object}	routes.ErrorResponse	"internal server error"
//	@Router			/projects/{id} [get]
func (h *projectRouteHandler) projectGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID

	p, err := h.projectService.GetProject(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isMember, err := h.projectService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only project members can access this project"})
	}

	return c.JSON(http.StatusOK, routes.MapToReturnProj(*p))
}

//	@Summary		Get project members
//	@Description	List all members assigned to a project
//	@Tags			projects
//	@Produce		json
//	@Param			id	path		string	true	"Project ID"
//	@Success		200	{array}		routes.ReturnMember
//	@Failure		400	{object}	routes.ErrorResponse	"invalid project id"
//	@Failure		404	{object}	routes.ErrorResponse	"project not found"
//	@Failure		500	{object}	routes.ErrorResponse	"internal server error"
//	@Router			/projects/{id}/members [get]
func (h *projectRouteHandler) membersGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID

	if _, err := h.projectService.GetProject(c.Request().Context(), id); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isMember, err := h.projectService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only project members can access this project"})
	}

	members, err := h.projectService.GetProjectMembers(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, routes.Map(members, routes.MapToReturnMember))
}

//	@Summary		Create project
//	@Description	Create a new project for the authenticated user
//	@Tags			projects
//	@Accept			json
//	@Produce		json
//	@Param			request	body		CreateProjectRequest	true	"Project data"
//	@Success		201		{object}	routes.ReturnProj
//	@Failure		400		{object}	routes.ErrorResponse	"invalid request body"
//	@Failure		409		{object}	routes.ErrorResponse	"duplicate slug"
//	@Failure		500		{object}	routes.ErrorResponse	"internal server error"
//	@Router			/projects [post]
func (h *projectRouteHandler) projectPOSTHandle(c *echo.Context) error {
	var req CreateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	userId := h.authService.GetClaims(c).UserID

	p, err := h.projectService.CreateProject(c.Request().Context(), &userId, req.Name, req.Slug, req.Description, req.Status)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, routes.MapToReturnProj(*p))
}

//	@Summary		Add members to project
//	@Description	Add one or multiple users to a project with specific roles
//	@Tags			projects
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Project ID"
//	@Param			request	body		[]AddMemberRequest	true	"List of users and roles"
//	@Success		201		{array}		routes.ReturnMember
//	@Failure		400		{object}	routes.ErrorResponse	"invalid request body | invalid project id"
//	@Failure		401		{object}	routes.ErrorResponse	"only the owner can add members to this project"
//	@Failure		404		{object}	routes.ErrorResponse	"user not found | project not found"
//	@Failure		409		{object}	routes.ErrorResponse	"user already member"
//	@Router			/projects/{id}/members [post]
func (h *projectRouteHandler) memberPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}
	var req []AddMemberRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectOwner(c.Request().Context(), userId, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only the owner can add members to this project"})
	}

	var projectMembers []projectService.AddMemberRequest
	for _, user := range req {
		projectMembers = append(projectMembers, projectService.AddMemberRequest{
			UserId: user.UserId,
			Role:   user.Role,
		})
	}

	u, err := h.projectService.AddUsersToProject(c.Request().Context(), projectMembers, id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, routes.Map(u, routes.MapToReturnMember))
}

//	@Summary		Update project
//	@Description	Change general project data. Must be project owner.
//	@Tags			projects
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Project ID"
//	@Param			request	body		updateProjectRequest	true	"Updated fields"
//	@Success		200		{object}	routes.ReturnProj
//	@Failure		400		{object}	routes.ErrorResponse	"invalid request body | invalid project id"
//	@Failure		401		{object}	routes.ErrorResponse	"only the owner can update this project"
//	@Failure		404		{object}	routes.ErrorResponse	"project not found"
//	@Failure		409		{object}	routes.ErrorResponse	"duplicate slug"
//	@Router			/projects/{id} [patch]
func (h *projectRouteHandler) projectPATCHHandle(c *echo.Context) error {
	ctx := c.Request().Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectOwner(ctx, userId, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only the owner can update this project"})
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

	return c.JSON(http.StatusOK, routes.MapToReturnProj(*p))
}

//	@Summary		Delete project
//	@Description	Permanently delete a project
//	@Tags			projects
//	@Param			id	path	string	true	"Project ID"
//	@Success		204	"No Content"
//	@Failure		400	{object}	routes.ErrorResponse	"invalid project id"
//	@Failure		401	{object}	routes.ErrorResponse	"only the owner can delete this project"
//	@Failure		404	{object}	routes.ErrorResponse	"project not found"
//	@Failure		500	{object}	routes.ErrorResponse	"internal server error"
//	@Router			/projects/{id} [delete]
func (h *projectRouteHandler) projectDELETEHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectOwner(c.Request().Context(), userId, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only the owner can delete this project"})
	}

	if err := h.projectService.DeleteProject(c.Request().Context(), id); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}

//	@Summary		Remove member
//	@Description	Remove a specific user from the project members
//	@Tags			projects
//	@Param			id		path	string	true	"Project ID"
//	@Param			userid	path	string	true	"User ID"
//	@Success		204		"No Content"
//	@Failure		400		{object}	routes.ErrorResponse	"invalid id"
//	@Failure		401		{object}	routes.ErrorResponse	"only the project owner can remove members"
//	@Failure		404		{object}	routes.ErrorResponse	"project not found | user not found"
//	@Router			/projects/{id}/members/{userid} [delete]
func (h *projectRouteHandler) memberDELETEHandle(c *echo.Context) error {
	projid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}
	userid, err := uuid.Parse(c.Param("userid"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid user id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectOwner(c.Request().Context(), userId, projid)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only the owner can remove members from this project"})
	}

	if err := h.projectService.RemoveUserFromProject(c.Request().Context(), userid, projid); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}
