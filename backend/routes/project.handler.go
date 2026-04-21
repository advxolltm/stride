package routes

import (
	"errors"
	"net/http"

	authService "backend/services/auth"
	projectService "backend/services/project"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type projectRouteHandler struct {
	projectService projectService.ProjectService
	authService    authService.AuthService
}

func NewProjectRouteHandler(ps projectService.ProjectService, as authService.AuthService) *projectRouteHandler {
	return &projectRouteHandler{projectService: ps, authService: as}
}

func (h projectRouteHandler) AddRoutes(api *echo.Group) {
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

// @Summary		Get all projects
// @Description	Get all projects for the authenticated user
// @Tags			projects
// @Produce		json
// @Success		200	{array}		ReturnProj
// @Failure		404	{object}	ErrorResponse	"user not found"
// @Failure		500	{object}	ErrorResponse	"internal server error"
// @Router			/projects [get]
func (h projectRouteHandler) projectsGETHandle(c *echo.Context) error {
	userid := h.authService.GetClaims(c).UserID

	projects, err := h.projectService.GetAllProjects(c.Request().Context(), userid)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, Map(projects, mapToReturnProj))
}

// @Summary		Get project by ID
// @Description	Get a specific project's details including creator, members, and skills
// @Tags			projects
// @Produce		json
// @Param			id	path		string	true	"Project ID"
// @Success		200	{object}	ReturnProj
// @Failure		400	{object}	ErrorResponse	"invalid project id"
// @Failure		404	{object}	ErrorResponse	"project not found"
// @Failure		500	{object}	ErrorResponse	"internal server error"
// @Router			/projects/{id} [get]
func (h projectRouteHandler) projectGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID
	isMember, err := h.authService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "only project members can access this project"})
	}

	p, err := h.projectService.GetProject(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, mapToReturnProj(*p))
}

// @Summary		Get project members
// @Description	List all members assigned to a project
// @Tags			projects
// @Produce		json
// @Param			id	path		string	true	"Project ID"
// @Success		200	{array}		ReturnMember
// @Failure		400	{object}	ErrorResponse	"invalid project id"
// @Failure		404	{object}	ErrorResponse	"project not found"
// @Failure		500	{object}	ErrorResponse	"internal server error"
// @Router			/projects/{id}/members [get]
func (h projectRouteHandler) membersGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID
	isMember, err := h.authService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "only project members can access this project"})
	}

	members, err := h.projectService.GetProjectMembers(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, Map(members, mapToReturnMember))
}

// @Summary		Get project skills
// @Description	List all skills associated with a specific project
// @Tags			projects
// @Produce		json
// @Param			id	path		string	true	"Project ID"
// @Success		200	{array}		ReturnSkill
// @Failure		400	{object}	ErrorResponse	"invalid project id"
// @Failure		404	{object}	ErrorResponse	"project not found"
// @Failure		500	{object}	ErrorResponse	"internal server error"
// @Router			/projects/{id}/skills [get]
func (h projectRouteHandler) skillsGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID
	isMember, err := h.authService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "only project members can access this project"})
	}

	skills, err := h.projectService.GetProjectSkills(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, Map(skills, mapToReturnSkill))
}

// @Summary		Create project
// @Description	Create a new project for the authenticated user
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			request	body		CreateProjectRequest	true	"Project data"
// @Success		201		{object}	ReturnProj
// @Failure		400		{object}	ErrorResponse	"invalid request body"
// @Failure		409		{object}	ErrorResponse	"duplicate slug"
// @Failure		500		{object}	ErrorResponse	"internal server error"
// @Router			/projects [post]
func (h projectRouteHandler) projectPOSTHandle(c *echo.Context) error {
	var req CreateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	userId := h.authService.GetClaims(c).UserID

	p, err := h.projectService.CreateProject(c.Request().Context(), &userId, req.Name, req.Slug, req.Description, req.Status)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, mapToReturnProj(*p))
}

// @Summary		Add members to project
// @Description	Add one or multiple users to a project with specific roles
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			id		path		string						true	"Project ID"
// @Param			request	body		[]project.AddMemberRequest	true	"List of users and roles"
// @Success		201		{array}		ReturnMember
// @Failure		400		{object}	ErrorResponse	"invalid request body | invalid project id"
// @Failure		401		{object}	ErrorResponse	"only the owner can add members to this project"
// @Failure		404		{object}	ErrorResponse	"user not found | project not found | user is already a member of the project"
// @Failure		409		{object}	ErrorResponse	"user already member"
// @Router			/projects/{id}/members [post]
func (h projectRouteHandler) memberPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}
	var req []projectService.AddMemberRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.authService.IsProjectOwner(c.Request().Context(), userId, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "only the owner can add members to this project"})
	}

	u, err := h.projectService.AddUsersToProject(c.Request().Context(), req, id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, Map(u, mapToReturnMember))

}

// @Summary		Add project skill
// @Description	Create a new required skill for the project
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			id		path		string				true	"Project ID"
// @Param			request	body		createSkillRequest	true	"Skill details"
// @Success		200		{object}	ReturnSkill
// @Failure		400		{object}	ErrorResponse	"invalid request  body | invalid project id"
// @Failure		404		{object}	ErrorResponse	"project not found"
// @Router			/projects/{id}/skills [post]
func (h projectRouteHandler) skillsPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID
	isMember, err := h.authService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "only project members can add skills to this project"})
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

	return c.JSON(http.StatusCreated, mapToReturnSkill(*s))
}

// @Summary		Update project
// @Description	Change general project data. Must be project owner.
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			id		path		string					true	"Project ID"
// @Param			request	body		updateProjectRequest	true	"Updated fields"
// @Success		200		{object}	ReturnProj
// @Failure		400		{object}	ErrorResponse	"invalid request body | invalid project id"
// @Failure		401		{object}	ErrorResponse	"only the owner can update this project"
// @Failure		404		{object}	ErrorResponse	"project not found"
// @Failure		409		{object}	ErrorResponse	"duplicate slug"
// @Router			/projects/{id} [patch]
func (h projectRouteHandler) projectPATCHHandle(c *echo.Context) error {
	ctx := c.Request().Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.authService.IsProjectOwner(ctx, userId, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	}

	if !isOwner {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "only the owner can update this project"})
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

// @Summary		Delete project
// @Description	Permanently delete a project
// @Tags			projects
// @Param			id	path	string	true	"Project ID"
// @Success		204	"No Content"
// @Failure		400	{object}	ErrorResponse	"invalid project id"
// @Failure		401	{object}	ErrorResponse	"only the owner can delete this project"
// @Failure		404	{object}	ErrorResponse	"project not found"
// @Failure		500	{object}	ErrorResponse	"internal server error"
// @Router			/projects/{id} [delete]
func (h projectRouteHandler) projectDELETEHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.authService.IsProjectOwner(c.Request().Context(), userId, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "only the owner can delete this project"})
	}

	if err := h.projectService.DeleteProject(c.Request().Context(), id); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}

// @Summary		Remove member
// @Description	Remove a specific user from the project members
// @Tags			projects
// @Param			id		path	string	true	"Project ID"
// @Param			userid	path	string	true	"User ID"
// @Success		204	"No Content"
// @Failure		400	{object}	ErrorResponse	"invalid id"
// @Failure		401	{object}	ErrorResponse	"only the project owner can remove members"
// @Failure 	404 {object} 	ErrorResponse 	"project not found | user not found"
// @Router			/projects/{id}/members/{userid} [delete]
func (h projectRouteHandler) memberDELETEHandle(c *echo.Context) error {
	projid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}
	userid, err := uuid.Parse(c.Param("userid"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.authService.IsProjectOwner(c.Request().Context(), userId, projid)
	if err != nil {
		return c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "only the owner can remove members from this project"})
	}

	if err := h.projectService.RemoveUserFromProject(c.Request().Context(), userid, projid); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)

}

// @Summary		Delete project skill
// @Description	Remove a skill from the project
// @Tags			projects
// @Param			id	path	string	true	"Skill ID"
// @Success		204	"No Content"
// @Failure		400	{object}	ErrorResponse	"invalid skill id"
// @Failure		404	{object}	ErrorResponse	"skill not found"
// @Router			/projects/skills/{id} [delete]
func (h projectRouteHandler) skillsDELETEHandle(c *echo.Context) error {
	skillid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid skill id"})
	}

	projId, err := h.projectService.GetProjectIdBySkillId(c.Request().Context(), skillid)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.authService.IsProjectOwner(c.Request().Context(), userId, projId)
	if err != nil {
		return c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "only the owner can delete this project"})
	}

	if err := h.projectService.RemoveProjectSkill(c.Request().Context(), skillid); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}
