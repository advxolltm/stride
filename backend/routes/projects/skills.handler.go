package projects

import (
	"log/slog"
	"net/http"

	"backend/routes"
	authService "backend/services/auth"
	projectService "backend/services/project"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type skillsRouteHandler struct {
	projectService projectService.ProjectService
	authService    authService.AuthService
	rdb            *redis.Client
}

func newSkillsRouteHandler(ps projectService.ProjectService, as authService.AuthService, rdb *redis.Client) *skillsRouteHandler {
	return &skillsRouteHandler{projectService: ps, authService: as, rdb: rdb}
}

func (h *skillsRouteHandler) registerRoutes(g *echo.Group) {
	g.GET("/:id/skills", h.skillsGETHandle)
	g.POST("/:id/skills", h.skillsPOSTHandle)
	g.DELETE("/skills/:id", h.skillsDELETEHandle)
}

type createSkillRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
} // @name CreateSkillRequest

// @Summary		Get project skills
// @Description	List all skills associated with a specific project
// @Tags			projects
// @Produce		json
// @Param			id	path		string	true	"Project ID"
// @Success		200	{array}		routes.ReturnSkill
// @Failure		400	{object}	routes.ErrorResponse	"invalid project id"
// @Failure		404	{object}	routes.ErrorResponse	"project not found"
// @Failure		500	{object}	routes.ErrorResponse	"internal server error"
// @Router			/projects/{id}/skills [get]
func (h *skillsRouteHandler) skillsGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only project members can access this project"})
	}

	skills, err := h.projectService.GetProjectSkills(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, routes.Map(skills, routes.MapToReturnSkill))
}

// @Summary		Add project skill
// @Description	Create a new required skill for the project
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			id		path		string				true	"Project ID"
// @Param			request	body		createSkillRequest	true	"Skill details"
// @Success		201		{object}	routes.ReturnSkill
// @Failure		400		{object}	routes.ErrorResponse	"invalid request body | invalid project id"
// @Failure		401		{object}	routes.ErrorResponse	"only project members can add skills to this project"
// @Failure		404		{object}	routes.ErrorResponse	"project not found"
// @Router			/projects/{id}/skills [post]
func (h *skillsRouteHandler) skillsPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only project members can add skills to this project"})
	}

	var req createSkillRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	s, err := h.projectService.AddProjectSkill(c.Request().Context(), id, req.Name, req.Description)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedSkill := routes.MapToReturnSkill(*s)
	if err := routes.SendWSUpdate(c.Request().Context(), h.rdb, id, routes.ProjectSkillAdd, mappedSkill); err != nil {
		slog.Error("skillsPOSTHandle: Failed to send ws update", "error", err)
	}

	return c.JSON(http.StatusCreated, mappedSkill)
}

// @Summary		Delete project skill
// @Description	Remove a skill from the project
// @Tags			projects
// @Param			id	path	string	true	"Skill ID"
// @Success		204	"No Content"
// @Failure		400	{object}	routes.ErrorResponse	"invalid skill id"
// @Failure		401	{object}	routes.ErrorResponse	"only the owner can delete this skill"
// @Failure		404	{object}	routes.ErrorResponse	"skill not found"
// @Router			/projects/skills/{id} [delete]
func (h *skillsRouteHandler) skillsDELETEHandle(c *echo.Context) error {
	skillid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid skill id"})
	}

	projId, err := h.projectService.GetProjectIdBySkillId(c.Request().Context(), skillid)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectMember(c.Request().Context(), userId, projId)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only the owner can delete this skill"})
	}

	if err := h.projectService.RemoveProjectSkill(c.Request().Context(), skillid); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	type projectSkillRemoveWSUpdate struct {
		ProjectSkillID uuid.UUID `json:"project_skill_id"`
	} // @name ProjectSkillRemoveWSUpdate

	if err := routes.SendWSUpdate(c.Request().Context(), h.rdb, projId, routes.ProjectSkillRemove, projectSkillRemoveWSUpdate{
		ProjectSkillID: skillid,
	}); err != nil {
		slog.Error("skillsDELETEHandle: Failed to send ws update", "error", err)
	}

	return c.NoContent(http.StatusNoContent)
}
