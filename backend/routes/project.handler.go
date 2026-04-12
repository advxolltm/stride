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
	g.GET("/:id/members", h.membersGETHandle)
	g.POST("", h.projectPOSTHandle)
	g.POST("/:id/members", h.memberPOSTHandle)
	g.DELETE("/:id/members/:userid", h.memberDELETEHandle)
	g.PATCH("/:id", h.projectPATCHHandle)
	g.DELETE("/:id", h.projectDELETEHandle)
}

type errorResponse struct {
    Error		string	`json:"error"`
}

type createProjectRequest struct { // createdBy *uuid.UUID, name string, slug string, description *string, status string
	Name		string	`json:"name"`
	Slug		string	`json:"slug"`
	Description	*string	`json:"description"`
	Status		string	`json:"status"`
}

type addMemberReqest struct {
	UserId		uuid.UUID 	`json:"userid"`
	Role		string		`json:"role"`
}

type updateProjectRequest struct {
	Name		*string	`json:"name"`
	Slug		*string	`json:"slug"`
	Description	*string	`json:"description"`
	Status		*string	`json:"status"`
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

// GET /projects:id/members
func (h projectRouteHandler) membersGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid project id"})
	}

	// TODO: add user-check

	members, err := h.projectService.GetProjectMembers(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceError(err)
		return c.JSON(status, errorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, members)
}

// POST /projects
func (h projectRouteHandler) projectPOSTHandle(c *echo.Context) error {
	var req createProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid request body"})
	}

	// TODO: add user-check - only user can create Projects, add the userid as a parameter for createdBy field

	//createdBy *uuid.UUID, name string, slug string, description *string, status string
	p, err := h.projectService.CreateProject(c.Request().Context(), nil, req.Name, req.Slug, req.Description, req.Status)
	if err != nil {
		status, msg := mapServiceError(err)
		return c.JSON(status, errorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, p)
}

// POST /projects/:id/members
func (h projectRouteHandler) memberPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid project id"})
	}

	var req addMemberReqest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid request body"})
	}

	p, err := h.projectService.AddUserToProject(c.Request().Context(), req.UserId, id, req.Role)
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
		Name:			req.Name,
		Slug: 			req.Slug,
		Description: 	req.Description,
		Status: 		req.Status,
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

func (h projectRouteHandler) memberDELETEHandle(c *echo.Context) error {
	projid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid user id"})
	}
	userid, err := uuid.Parse(c.Param("userid"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid user id"})
	}


	// TODO: ONLY PROJECT OWNER CAN REMOVE USERS
	if err := h.projectService.RemoveUserFromProject(c.Request().Context(), userid, projid); err != nil {
		status, msg := mapServiceError(err)
		return c.JSON(status, errorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)

}