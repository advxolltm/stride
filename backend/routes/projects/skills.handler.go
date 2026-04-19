package projects

import (
	"net/http"

	"backend/routes"
	projectService "backend/services/project"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type skillsRouteHandler struct {
	projectService projectService.ProjectService
}

func newSkillsRouteHandler(ps projectService.ProjectService) *skillsRouteHandler {
	return &skillsRouteHandler{projectService: ps}
}

func (h *skillsRouteHandler) registerRoutes(g *echo.Group) {
	g.GET("/:id/skills", h.skillsGETHandle)
	g.POST("/:id/skills", h.skillsPOSTHandle)
	g.DELETE("/skills/:id", h.skillsDELETEHandle)
}

type createSkillRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

// GET /projects/:id/skills
func (h *skillsRouteHandler) skillsGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	skills, err := h.projectService.GetProjectSkills(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, skills)
}

// POST /projects/:id/skills
func (h *skillsRouteHandler) skillsPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
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

	return c.JSON(http.StatusOK, s)
}

// DELETE /projects/skills/:id
func (h *skillsRouteHandler) skillsDELETEHandle(c *echo.Context) error {
	skillid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid skill id"})
	}

	if err := h.projectService.RemoveProjectSkill(c.Request().Context(), skillid); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}