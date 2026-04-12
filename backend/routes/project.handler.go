package routes

import (
	"errors"
	"net/http"

	projectService "backend/services/project"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

// TODO: Tests user.handler.go
type projectRouteHandler struct {
	projectService	projectService.ProjectService
}


func NewProjectRouteHandler(ps projectService.ProjectService) *projectRouteHandler {
	return &projectRouteHandler{projectService: ps}
}

func (h projectRouteHandler) AddRoutes(api *echo.Group) {
	// TODO: add auth middleware
	g := api.Group("/projects")
	g.GET("", h.projectsGETHandle)
	g.GET("/:id", h.projectGETHandle)
	g.POST("", h.projectPOSTHandle)
	g.PATCH("/:id", h.projectPATCHHandle)
	g.DELETE("/:id", h.projectDELETEHandle)
}

type errorResponse struct {
    Error		string	`json:"error"`
}

type createProjectRequest struct { // createdBy *uuid.UUID, name string, slug string, description *string, status string
	name		string	`json:"name"`
	slug		string	`json:"slug"`
	description	*string	`json:"description"`
	status		string	`json:"status"`
}

type updateProjectRequest struct {
	name		*string	`json:"name"`
	slug		*string	`json:"slug"`
	description	*string	`json:"description"`
	status		*string	`json:"status"`
}

func mapServiceError(err error) (int, string) {
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
func (h projectRouteHandler) projectsGETHandle(c *echo.Context) error {
	// TODO: add user-check

	projects, err := h.projectService.GetAllProjects(c.Request().Context())
	if err != nil {
		status, msg := mapServiceError(err)
		return c.JSON(status, errorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, projects)
}

// GET /projects/:id
func (h projectRouteHandler) projectGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid project id"})
	}

	// TODO: add user-check - only admin and user himself can retrieve data

	p, err := h.projectService.GetProject(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceError(err)
		return c.JSON(status, errorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, p)
}

// POST /projects
func (h projectRouteHandler) projectPOSTHandle(c *echo.Context) error {
	var req createProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid request body"})
	}

	// TODO: add user-check - only user can create Projects, add the userid as a parameter for createdBy field

	//createdBy *uuid.UUID, name string, slug string, description *string, status string
	p, err := h.projectService.CreateProject(c.Request().Context(), nil, req.name, req.slug, req.description, req.status)
	if err != nil {
		status, msg := mapServiceError(err)
		return c.JSON(status, errorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, p)
}

// PATCH /projects/:id
func (h projectRouteHandler) projectPATCHHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid project id"})
	}

	var req updateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid request body"})
	}

	p, err := h.projectService.UpdateProject(c.Request().Context(), id, projectService.UpdateProjectInput{
		Name:			req.name,
		Slug: 			req.password,
		Description: 	req.description,
		Status: 		req.status,
	})
	if err != nil {
		status, msg := mapServiceError(err)
		return c.JSON(status, errorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, p)
}

// DELETE /projects/:id
func (h projectRouteHandler) projectDELETEHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid user id"})
	}

	if err := h.projectService.DeleteProject(c.Request().Context(), id); err != nil {
		status, msg := mapServiceError(err)
		return c.JSON(status, errorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}