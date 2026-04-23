package task

import (
	"backend/models"
	"backend/routes"
	authService "backend/services/auth"
	projectService "backend/services/project"
	taskService "backend/services/task"
	"errors"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type taskRouteHandler struct {
	authService    authService.AuthService
	taskService    taskService.TaskService
	projectService projectService.ProjectService
}

func NewTaskRouteHandler(authService authService.AuthService, taskService taskService.TaskService, projectService projectService.ProjectService) *taskRouteHandler {
	return &taskRouteHandler{authService, taskService, projectService}
}

func (h taskRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/tasks", h.authService.AuthenticatedMiddleware())
	g.GET("/task/:id", h.taskGET)
	g.POST("/task", h.taskPOST)
	g.PATCH("/task/:id", h.taskPATCH)
	g.DELETE("/task/:id", h.taskDELETE)

	g.POST("/task/:id/assign", h.taskAssignPOST)
	g.POST("/task/:id/unassign", h.taskUnassignPOST)
	g.POST("/task/:id/move", h.taskMovePOST)

	g.GET("/for-project/:id", h.tasksForProjectGET)
	g.GET("/for-project/:id/my-tasks", h.tasksForProjectAssignedToMeGET)
}

func (h taskRouteHandler) mapServiceError(err error) (int, string) {
	switch {
	case errors.Is(err, taskService.ErrTaskNotFound):
		return http.StatusNotFound, err.Error()
	default:
		slog.Error("unexpected error in task route handler", "error", err.Error())
		return http.StatusInternalServerError, "internal server error"
	}
}

// @Summary Get a specific task. Must be part of the project of the task.
// @Tags task
// @Param id path string true "Task ID"
// @Success 200 {object} Task "the returned task"
// @Failure 404 {object} ErrorResponse "task not found"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Router /tasks/task/{id} [get]
func (h taskRouteHandler) taskGET(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid task id"})
	}

	task, err := h.taskService.GetTask(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, task.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	mappedTask := routes.MapTask(*task)
	return c.JSON(http.StatusOK, mappedTask)
}

type createTaskRequest struct {
	ProjectID               uuid.UUID        `json:"project_id"`
	Title                   string           `json:"title"`
	Description             *string          `json:"description"`
	Status                  string           `json:"status"`
	StartDate               *routes.DateOnly `json:"start_date" swaggertype:"string" format:"date"`
	DueDate                 *routes.DateOnly `json:"due_date" swaggertype:"string" format:"date"`
	ExpectedDurationMinutes *int             `json:"expected_duration_minutes"`
	Position                *int             `json:"position"`
} // @name CreateTaskRequest

// @Summary Create a new task. Must be part of the project of the task.
// @Tags task
// @Param task body createTaskRequest true "Create task data. Note: leaving out the position (or setting it null) appends the task at the end automatically."
// @Success 201 {object} Task "the created task"
// @Failure 400 {object} ErrorResponse "bad request"
// @Failure 404 {object} ErrorResponse "project not found"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Router /tasks/task [post]
func (h taskRouteHandler) taskPOST(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	var req createTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, req.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	userPM, err := h.projectService.GetProjectMember(ctx, req.ProjectID, userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	pos := -1
	if req.Position != nil {
		pos = *req.Position
	}

	task := models.Task{
		ProjectID:               userPM.ProjectID,
		CreatedBy:               userPM.ID,
		Title:                   req.Title,
		Description:             req.Description,
		Status:                  req.Status,
		StartDate:               req.StartDate.ToTime(),
		DueDate:                 req.DueDate.ToTime(),
		ExpectedDurationMinutes: req.ExpectedDurationMinutes,
		Position:                pos,
	}

	err = h.taskService.CreateTask(ctx, &task)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedTask := routes.MapTask(task)
	return c.JSON(http.StatusCreated, mappedTask)
}

type updateTaskFieldsRequest struct {
	Title                   routes.Nullable[string]          `json:"title"`
	Description             routes.Nullable[string]          `json:"description,omitempty"`
	Status                  routes.Nullable[string]          `json:"status"`
	StartDate               routes.Nullable[routes.DateOnly] `json:"start_date,omitempty" swaggertype:"string" format:"date"`
	DueDate                 routes.Nullable[routes.DateOnly] `json:"due_date,omitempty" swaggertype:"string" format:"date"`
	ExpectedDurationMinutes routes.Nullable[int]             `json:"expected_duration_minutes,omitempty"`
} // @name UpdateTaskFieldsRequest

// @Summary Update a specific task. Must be part of the project of the task.
// @Tags task
// @Param id path string true "Task ID"
// @Param data body updateTaskFieldsRequest true "Fields to update a task"
// @Success 200 {object} Task "the updated task"
// @Failure 404 {object} ErrorResponse "task not found"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Router /tasks/task/{id} [patch]
func (h taskRouteHandler) taskPATCH(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid task id"})
	}

	task, err := h.taskService.GetTask(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, task.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	var req updateTaskFieldsRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	updatedTask, err := h.taskService.UpdateTask(ctx, taskID, taskService.UpdateTaskFields{
		Title:                   req.Title.Ptr(),
		Description:             req.Description.PtrPtr(),
		Status:                  req.Status.Ptr(),
		StartDate:               routes.ToTimeOpt(req.StartDate.PtrPtr()),
		DueDate:                 routes.ToTimeOpt(req.DueDate.PtrPtr()),
		ExpectedDurationMinutes: req.ExpectedDurationMinutes.PtrPtr(),
	})

	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedTask := routes.MapTask(*updatedTask)
	return c.JSON(http.StatusOK, mappedTask)
}

// @Summary Delete a specific task. Must be part of the project of the task.
// @Tags task
// @Param id path string true "Task ID"
// @Success 200 {object} Task "the updated task"
// @Failure 404 {object} ErrorResponse "task not found"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Router /tasks/task/{id} [delete]
func (h taskRouteHandler) taskDELETE(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid task id"})
	}

	task, err := h.taskService.GetTask(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, task.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	err = h.taskService.DeleteTask(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusOK)
}

type assignProjectMemberToTaskRequest struct {
	ProjectMemberID uuid.UUID `json:"project_member_id"`
} // @name AssignProjectMemberToTaskRequest

// @Summary Assigns a task to a project member. Both the assigner (authenticated user) and the assignee must be part of the project.
// @Tags task
// @Param id path string true "Task ID"
// @Param data body assignProjectMemberToTaskRequest true "The project member to assign"
// @Success 201 {object} TaskAssignee "the created task assignment"
// @Failure 404 {object} ErrorResponse "task not found"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Router /tasks/task/{id}/assign [post]
func (h taskRouteHandler) taskAssignPOST(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid task id"})
	}

	task, err := h.taskService.GetTask(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, task.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	var req assignProjectMemberToTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	taskAssignee, err := h.taskService.AssignTask(ctx, taskID, req.ProjectMemberID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedTaskAssignee := routes.MapTaskAssignee(*taskAssignee)

	return c.JSON(http.StatusCreated, mappedTaskAssignee)
}

type unassignProjectMemberToTaskRequest struct {
	ProjectMemberID uuid.UUID `json:"project_member_id"`
} // @name UnassignProjectMemberToTaskRequest

// @Summary Unassigns a task from a project member. Both the assigner (authenticated user) and the assignee must be part of the project.
// @Tags task
// @Param id path string true "Task ID"
// @Param data body unassignProjectMemberToTaskRequest true "Member to unassign"
// @Success 200
// @Failure 404 {object} ErrorResponse "task not found"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Router /tasks/task/{id}/unassign [post]
func (h taskRouteHandler) taskUnassignPOST(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid task id"})
	}

	task, err := h.taskService.GetTask(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, task.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	var req unassignProjectMemberToTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	err = h.taskService.UnassignTask(ctx, taskID, req.ProjectMemberID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusOK)
}

type moveTaskRequest struct {
	Position int `json:"position"`
}

// @Summary Changes the position of the task. Must be part of the project.
// @Tags task
// @Param id path string true "Task ID"
// @Success 200 {array} Task "all tasks of the project with their positions updated"
// @Failure 404 {object} ErrorResponse "task not found"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Failure 400 {object} ErrorResponse "invalid position"
// @Router /tasks/task/{id}/move [post]
func (h taskRouteHandler) taskMovePOST(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid task id"})
	}

	task, err := h.taskService.GetTask(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, task.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	var req moveTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	err = h.taskService.MoveTask(ctx, taskID, req.Position)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	tasksOfProject, err := h.taskService.GetTasksForProject(ctx, task.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedTasksOfProject := routes.MapMany(tasksOfProject, routes.MapTask)

	return c.JSON(http.StatusOK, mappedTasksOfProject)
}

// @Summary Get all tasks of a project. Must be part of the project.
// @Tags task
// @Param id path string true "Project ID"
// @Success 200 {array} Task "Tasks of a project"
// @Failure 404 {object} ErrorResponse "project not found"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Router /tasks/for-project/{id} [get]
func (h taskRouteHandler) tasksForProjectGET(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, projectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	tasksOfProject, err := h.taskService.GetTasksForProject(ctx, projectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedTasksOfProject := routes.MapMany(tasksOfProject, routes.MapTask)

	return c.JSON(http.StatusOK, mappedTasksOfProject)
}

// @Summary Get all tasks of a project that are assigned to the authenticated user. Must be part of the project.
// @Tags task
// @Param id path string true "Project ID"
// @Success 200 {array} TaskAssigneeWithTask "Tasks of a project assigned to me"
// @Failure 404 {object} ErrorResponse "project not found"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Router /tasks/for-project/{id}/my-tasks [get]
func (h taskRouteHandler) tasksForProjectAssignedToMeGET(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, projectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	projectMember, err := h.projectService.GetProjectMember(ctx, projectID, userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	tasksOfProject, err := h.taskService.GetTasksAssignedToProjectMember(ctx, projectMember.ID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedTasksOfProject := routes.MapMany(tasksOfProject, routes.MapTaskAssigneeWithTask)

	return c.JSON(http.StatusOK, mappedTasksOfProject)
}
