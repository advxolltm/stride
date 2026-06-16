package task

import (
	"backend/db/whiteboard"
	"backend/models"
	"backend/routes"
	authService "backend/services/auth"
	notificationService "backend/services/notification"
	projectService "backend/services/project"
	taskService "backend/services/task"
	whiteboardService "backend/services/whiteboard"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
	"gorm.io/datatypes"
)

type taskRouteHandler struct {
	authService         authService.AuthService
	taskService         taskService.TaskService
	whiteboardService   whiteboardService.WhiteboardService
	projectService      projectService.ProjectService
	notificationService notificationService.NotificationService
	rdb                 *redis.Client
}

func NewTaskRouteHandler(
	authService authService.AuthService,
	taskService taskService.TaskService,
	whiteboardService whiteboardService.WhiteboardService,
	projectService projectService.ProjectService,
	notificationService notificationService.NotificationService,
	rdb *redis.Client,
) *taskRouteHandler {
	return &taskRouteHandler{
		authService:         authService,
		taskService:         taskService,
		whiteboardService:   whiteboardService,
		projectService:      projectService,
		notificationService: notificationService,
		rdb:                 rdb,
	}
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

	g.POST("/task/:id/add-skill", h.taskAddSkill)
	g.POST("/task/:id/remove-skill", h.taskRemoveSkill)

	g.GET("/for-project/:id", h.tasksForProjectGET)
	g.GET("/for-project/:id/my-tasks", h.tasksForProjectAssignedToMeGET)
}

func (h taskRouteHandler) mapServiceError(err error) (int, string) {
	switch {
	case errors.Is(err, taskService.ErrTaskNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, taskService.ErrSkillNotInSameProjectAsTask):
		return http.StatusBadRequest, err.Error()
	default:
		slog.Error("unexpected error in task route handler", "error", err.Error())
		return http.StatusInternalServerError, "internal server error"
	}
}

// @Summary	Get a specific task. Must be member of the project of the task.
// @Tags		task
// @Param		id	path		string			true	"Task ID"
// @Success	200	{object}	Task			"the returned task"
// @Failure	404	{object}	ErrorResponse	"task not found"
// @Failure	401	{object}	ErrorResponse	"unauthorized"
// @Router		/tasks/task/{id} [get]
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
	ProjectID             uuid.UUID        `json:"project_id"`
	Title                 string           `json:"title"`
	Description           *string          `json:"description"`
	Status                string           `json:"status"`
	StartDate             *routes.DateOnly `json:"start_date" swaggertype:"string" format:"date"`
	DueDate               *routes.DateOnly `json:"due_date" swaggertype:"string" format:"date"`
	ExpectedDurationHours *int             `json:"expected_duration_hours"`
	Position              *int             `json:"position"`
} //	@name	CreateTaskRequest

// @Summary	Create a new task. Must be member of the project of the task.
// @Tags		task
// @Param		task	body		createTaskRequest	true	"Create task data. Note: leaving out the position (or setting it null) appends the task at the end automatically."
// @Success	201		{object}	Task				"the created task"
// @Failure	400		{object}	ErrorResponse		"bad request"
// @Failure	404		{object}	ErrorResponse		"project not found"
// @Failure	401		{object}	ErrorResponse		"unauthorized"
// @Router		/tasks/task [post]
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
		ProjectID:             userPM.ProjectID,
		CreatedBy:             userPM.ID,
		Title:                 req.Title,
		Description:           req.Description,
		Status:                req.Status,
		StartDate:             req.StartDate.ToTime(),
		DueDate:               req.DueDate.ToTime(),
		ExpectedDurationHours: req.ExpectedDurationHours,
		Position:              pos,
	}

	err = h.taskService.CreateTask(ctx, &task)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedTask := routes.MapTask(task)
	if err := routes.SendWSUpdate(ctx, h.rdb, task.ProjectID, routes.TaskCreate, mappedTask); err != nil {
		slog.Error("taskPOST: Failed to send ws update", "error", err)
	}

	return c.JSON(http.StatusCreated, mappedTask)
}

type updateTaskFieldsRequest struct {
	Title                 routes.Nullable[string]          `json:"title"`
	Description           routes.Nullable[string]          `json:"description,omitempty"`
	Status                routes.Nullable[string]          `json:"status"`
	StartDate             routes.Nullable[routes.DateOnly] `json:"start_date,omitempty" swaggertype:"string" format:"date"`
	DueDate               routes.Nullable[routes.DateOnly] `json:"due_date,omitempty" swaggertype:"string" format:"date"`
	ExpectedDurationHours routes.Nullable[int]             `json:"expected_duration_hours,omitempty"`
} //	@name	UpdateTaskFieldsRequest

type whiteboardElementWSUpdate struct {
	ID           uuid.UUID      `json:"id"`
	WhiteboardID uuid.UUID      `json:"whiteboardId"`
	CreatedBy    *uuid.UUID     `json:"createdBy"`
	ElementType  string         `json:"elementType"`
	Props        datatypes.JSON `json:"props"`
	ZIndex       int            `json:"zIndex"`
	CreatedAt    string         `json:"createdAt"`
	UpdatedAt    string         `json:"updatedAt"`
}

func mapWhiteboardElementWSUpdate(element *models.WhiteboardElement) whiteboardElementWSUpdate {
	return whiteboardElementWSUpdate{
		ID:           element.ID,
		WhiteboardID: element.WhiteboardID,
		CreatedBy:    element.CreatedBy,
		ElementType:  element.ElementType,
		Props:        element.Props,
		ZIndex:       element.ZIndex,
		CreatedAt:    element.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    element.UpdatedAt.Format(time.RFC3339),
	}
}

// @Summary	Update a specific task. Must be member of the project of the task.
// @Tags		task
// @Param		id		path		string					true	"Task ID"
// @Param		data	body		updateTaskFieldsRequest	true	"Fields to update a task"
// @Success	200		{object}	Task					"the updated task"
// @Failure	404		{object}	ErrorResponse			"task not found"
// @Failure	401		{object}	ErrorResponse			"unauthorized"
// @Router		/tasks/task/{id} [patch]
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
		Title:                 req.Title.Ptr(),
		Description:           req.Description.PtrPtr(),
		Status:                req.Status.Ptr(),
		StartDate:             routes.ToTimeOpt(req.StartDate.PtrPtr()),
		DueDate:               routes.ToTimeOpt(req.DueDate.PtrPtr()),
		ExpectedDurationHours: req.ExpectedDurationHours.PtrPtr(),
	})

	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if updatedTask.Title != task.Title {
		affectedTaskLinkElements, err := h.whiteboardService.FindTaskLinkElements(ctx, userID, updatedTask.ProjectID, updatedTask.ID)
		if err != nil {
			// TODO: maybe rollback the task-update change?
			slog.Error("taskPATCH: Failed to update linked whiteboard elements", "task", updatedTask.ID, "error", err)
		} else {
			for _, affectedElement := range affectedTaskLinkElements {
				if affectedElement.ElementType == "text" {
					var propsMap map[string]any
					if err = json.Unmarshal(affectedElement.Props, &propsMap); err != nil {
						// TODO: maybe rollback the task-update change?
						slog.Error("taskPATCH: Failed to update linked whiteboard elements", "task", updatedTask.ID, "whiteboard-element", affectedElement.ID, "error", err)
					}

					propsMap["text"] = updatedTask.Title
					propsMap["originalText"] = updatedTask.Title

					// TODO: somehow calculate this better, but this seems to be good enough for now
					propsMap["width"] = len(updatedTask.Title) * 10

					updatedProps, err := json.Marshal(propsMap)
					if err != nil {
						// TODO: maybe rollback the task-update change?
						slog.Error("taskPATCH: Failed to update linked whiteboard elements", "task", updatedTask.ID, "whiteboard-element", affectedElement.ID, "error", err)
					}

					affectedElement.Props = updatedProps

					updatedAffectedElement, err := h.whiteboardService.UpdateElement(ctx, userID, task.ProjectID, affectedElement.ID, whiteboard.UpdateElementFields{
						Props: &affectedElement.Props,
					})

					if err := routes.SendWSUpdate(
						c.Request().Context(),
						h.rdb,
						task.ProjectID,
						routes.WhiteboardElementUpdate,
						mapWhiteboardElementWSUpdate(updatedAffectedElement),
					); err != nil {
						slog.Error("taskPATCH: Failed to send ws update", "error", err)
					}

					if err != nil {
						// TODO: maybe rollback the task-update change?
						slog.Error("taskPATCH: Failed to update linked whiteboard elements", "task", updatedTask.ID, "whiteboard-element", affectedElement.ID, "error", err)
					}
				}
			}
		}
	}

	mappedTask := routes.MapTask(*updatedTask)
	if err := routes.SendWSUpdate(ctx, h.rdb, task.ProjectID, routes.TaskUpdate, mappedTask); err != nil {
		slog.Error("taskPATCH: Failed to send ws update", "error", err)
	}

	if task.Status != updatedTask.Status {
		h.notifyProjectMembersExcept(
			ctx,
			task.ProjectID,
			userID,
			"task",
			taskID,
			taskMovedNotificationMessage(*updatedTask),
			"taskPATCH",
		)
	} else {
		h.notifyTaskAssignees(
			ctx,
			*task,
			userID,
			"task",
			taskID,
			taskUpdatedNotificationMessage(*updatedTask),
			"taskPATCH",
		)
	}

	return c.JSON(http.StatusOK, mappedTask)
}

// @Summary	Delete a specific task. Must be member of the project of the task.
// @Tags		task
// @Param		id	path		string			true	"Task ID"
// @Success	200	{object}	Task			"the updated task"
// @Failure	404	{object}	ErrorResponse	"task not found"
// @Failure	401	{object}	ErrorResponse	"unauthorized"
// @Router		/tasks/task/{id} [delete]
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

	affectedTaskLinkElements, err := h.whiteboardService.FindTaskLinkElements(ctx, userID, task.ProjectID, task.ID)
	if err != nil {
		// TODO: maybe rollback the task-update change?
		slog.Error("taskDELETE: Failed to update linked whiteboard elements", "task", task.ID, "error", err)
	} else {
		for _, affectedElement := range affectedTaskLinkElements {
			err = h.whiteboardService.DeleteElement(ctx, userID, task.ProjectID, affectedElement.ID)
			if err != nil {
				// TODO: maybe rollback the task-update change?
				slog.Error("taskDELETE: Failed to delete linked whiteboard elements", "task", task.ID, "whiteboard-element", affectedElement.ID, "error", err)
			}

			if err := routes.SendWSUpdate(
				c.Request().Context(),
				h.rdb,
				task.ProjectID,
				routes.WhiteboardElementDelete,
				mapWhiteboardElementWSUpdate(&affectedElement),
			); err != nil {
				slog.Error("taskDELETE: Failed to send ws update", "error", err)
			}

			if err != nil {
				// TODO: maybe rollback the task-update change?
				slog.Error("taskDELETE: Failed to update linked whiteboard elements", "task", task.ID, "whiteboard-element", affectedElement.ID, "error", err)
			}
		}
	}

	type taskDeleteWSUpdate struct {
		DeletedTaskID uuid.UUID `json:"deletedTaskID"`
	} // @name TaskDeleteWSUpdate

	if err := routes.SendWSUpdate(ctx, h.rdb, task.ProjectID, routes.TaskDelete, taskDeleteWSUpdate{
		DeletedTaskID: task.ID,
	}); err != nil {
		slog.Error("taskDELETE: Failed to send ws update", "error", err)
	}

	h.notifyTaskAssignees(
		ctx,
		*task,
		userID,
		"project",
		task.ProjectID,
		taskDeletedNotificationMessage(*task),
		"taskDELETE",
	)

	return c.NoContent(http.StatusOK)
}

type assignProjectMemberToTaskRequest struct {
	ProjectMemberID uuid.UUID `json:"project_member_id"`
} //	@name	AssignProjectMemberToTaskRequest

// @Summary	Assigns a task to a project member. Both the assigner (authenticated user) and the assignee must be member of the project.
// @Tags		task
// @Param		id		path		string								true	"Task ID"
// @Param		data	body		assignProjectMemberToTaskRequest	true	"The project member to assign"
// @Success	201		{object}	TaskAssignee						"the created task assignment"
// @Failure	404		{object}	ErrorResponse						"task not found"
// @Failure	401		{object}	ErrorResponse						"unauthorized"
// @Router		/tasks/task/{id}/assign [post]
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
	if err := routes.SendWSUpdate(ctx, h.rdb, task.ProjectID, routes.TaskAssign, mappedTaskAssignee); err != nil {
		slog.Error("taskAssignPOST: Failed to send ws update", "error", err)
	}

	h.notifyProjectMember(
		ctx,
		task.ProjectID,
		req.ProjectMemberID,
		"task",
		taskID,
		taskAssignedNotificationMessage(*task),
		"taskAssignPOST",
	)

	return c.JSON(http.StatusCreated, mappedTaskAssignee)
}

type unassignProjectMemberToTaskRequest struct {
	ProjectMemberID uuid.UUID `json:"project_member_id"`
} //	@name	UnassignProjectMemberToTaskRequest

// @Summary	Unassigns a task from a project member. Both the assigner (authenticated user) and the assignee must be member of the project.
// @Tags		task
// @Param		id		path	string								true	"Task ID"
// @Param		data	body	unassignProjectMemberToTaskRequest	true	"Member to unassign"
// @Success	200
// @Failure	404	{object}	ErrorResponse	"task not found"
// @Failure	401	{object}	ErrorResponse	"unauthorized"
// @Router		/tasks/task/{id}/unassign [post]
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

	wasAssigned := taskHasProjectMemberAssignee(*task, req.ProjectMemberID)

	err = h.taskService.UnassignTask(ctx, taskID, req.ProjectMemberID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	type taskUnassignWSUpdate struct {
		TaskID          uuid.UUID `json:"taskID"`
		ProjectMemberID uuid.UUID `json:"projectMemberID"`
	} // @name TaskUnassignWSUpdate

	if err := routes.SendWSUpdate(ctx, h.rdb, task.ProjectID, routes.TaskUnassign, taskUnassignWSUpdate{
		TaskID:          taskID,
		ProjectMemberID: req.ProjectMemberID,
	}); err != nil {
		slog.Error("taskUnassignPOST: Failed to send ws update", "error", err)
	}

	if wasAssigned {
		h.notifyProjectMember(
			ctx,
			task.ProjectID,
			req.ProjectMemberID,
			"task",
			taskID,
			taskUnassignedNotificationMessage(*task),
			"taskUnassignPOST",
		)
	}

	return c.NoContent(http.StatusOK)
}

type moveTaskRequest struct {
	Position int `json:"position"`
}

// @Summary	Changes the position of the task. Must be member of the project.
// @Tags		task
// @Param		id	path		string			true	"Task ID"
// @Success	200	{array}		Task			"all tasks of the project with their positions updated"
// @Failure	404	{object}	ErrorResponse	"task not found"
// @Failure	401	{object}	ErrorResponse	"unauthorized"
// @Failure	400	{object}	ErrorResponse	"invalid position"
// @Router		/tasks/task/{id}/move [post]
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

	updatedTask, err := h.taskService.GetTask(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}
	mappedTask := routes.MapTask(*updatedTask)
	if err := routes.SendWSUpdate(ctx, h.rdb, task.ProjectID, routes.TaskMove, mappedTask); err != nil {
		slog.Error("taskMovePOST: Failed to send ws update", "error", err)
	}

	return c.JSON(http.StatusOK, mappedTask)
}

func (h taskRouteHandler) notifyProjectMembersExcept(
	ctx context.Context,
	projectID uuid.UUID,
	excludedUserID uuid.UUID,
	objectType string,
	objectID uuid.UUID,
	message string,
	logContext string,
) {
	if h.notificationService == nil {
		return
	}

	userIDs, err := h.projectService.GetProjectMemberUserIDsExcept(ctx, projectID, excludedUserID)
	if err != nil {
		slog.Error(logContext+": Failed to get project member user ids for notification", "error", err)
		return
	}

	if len(userIDs) == 0 {
		return
	}

	if err := h.notificationService.SendBulkNotification(
		ctx,
		userIDs,
		objectType,
		objectID,
		message,
	); err != nil {
		slog.Error(logContext+": Failed to send notification", "error", err)
	}
}

func (h taskRouteHandler) notifyProjectMember(
	ctx context.Context,
	projectID uuid.UUID,
	projectMemberID uuid.UUID,
	objectType string,
	objectID uuid.UUID,
	message string,
	logContext string,
) {
	if h.notificationService == nil {
		return
	}

	projectMembers, err := h.projectService.GetProjectMembers(ctx, projectID)
	if err != nil {
		slog.Error(logContext+": Failed to get project members for notification", "error", err)
		return
	}

	for _, projectMember := range projectMembers {
		if projectMember.ID != projectMemberID {
			continue
		}

		if projectMember.UserID == uuid.Nil {
			return
		}

		if err := h.notificationService.SendNotification(
			ctx,
			projectMember.UserID,
			objectType,
			objectID,
			message,
		); err != nil {
			slog.Error(logContext+": Failed to send notification", "error", err)
		}
		return
	}

	slog.Warn(logContext+": Project member for notification not found", "projectMemberID", projectMemberID)
}

func (h taskRouteHandler) notifyTaskAssignees(
	ctx context.Context,
	task models.Task,
	excludedUserID uuid.UUID,
	objectType string,
	objectID uuid.UUID,
	message string,
	logContext string,
) {
	if h.notificationService == nil {
		return
	}

	userIDs := taskAssigneeUserIDs(task, excludedUserID)
	if len(userIDs) == 0 {
		return
	}

	if err := h.notificationService.SendBulkNotification(
		ctx,
		userIDs,
		objectType,
		objectID,
		message,
	); err != nil {
		slog.Error(logContext+": Failed to send notification", "error", err)
	}
}

func taskMovedNotificationMessage(task models.Task) string {
	return fmt.Sprintf("Task moved to %s: %s", formatTaskStatus(task.Status), task.Title)
}

func taskAssignedNotificationMessage(task models.Task) string {
	return fmt.Sprintf("You were assigned to task: %s", task.Title)
}

func taskUnassignedNotificationMessage(task models.Task) string {
	return fmt.Sprintf("You were unassigned from task: %s", task.Title)
}

func taskUpdatedNotificationMessage(task models.Task) string {
	return fmt.Sprintf("Task updated: %s", task.Title)
}

func taskDeletedNotificationMessage(task models.Task) string {
	return fmt.Sprintf("Task deleted: %s", task.Title)
}

func taskSkillAddedNotificationMessage(task models.Task, skillName string) string {
	return fmt.Sprintf("Skill added to task %q: %s", task.Title, skillName)
}

func taskSkillRemovedNotificationMessage(task models.Task, skillName string) string {
	return fmt.Sprintf("Skill removed from task %q: %s", task.Title, skillName)
}

func formatTaskStatus(status string) string {
	switch status {
	case "todo":
		return "To Do"
	case "in_progress":
		return "In Progress"
	case "done":
		return "Done"
	default:
		return strings.TrimSpace(strings.ReplaceAll(status, "_", " "))
	}
}

func taskAssigneeUserIDs(task models.Task, excludedUserID uuid.UUID) uuid.UUIDs {
	userIDs := make(uuid.UUIDs, 0, len(task.Assignees))
	seenUserIDs := make(map[uuid.UUID]struct{}, len(task.Assignees))

	for _, assignee := range task.Assignees {
		userID := assignee.ProjectMember.UserID
		if userID == uuid.Nil || userID == excludedUserID {
			continue
		}

		if _, exists := seenUserIDs[userID]; exists {
			continue
		}

		seenUserIDs[userID] = struct{}{}
		userIDs = append(userIDs, userID)
	}

	return userIDs
}

func taskHasProjectMemberAssignee(task models.Task, projectMemberID uuid.UUID) bool {
	for _, assignee := range task.Assignees {
		if assignee.ProjectMemberID == projectMemberID {
			return true
		}
	}

	return false
}

func (h taskRouteHandler) projectSkillName(ctx context.Context, projectID uuid.UUID, skillID uuid.UUID, logContext string) string {
	projectSkills, err := h.projectService.GetProjectSkills(ctx, projectID)
	if err != nil {
		slog.Error(logContext+": Failed to get project skills for notification", "error", err)
		return skillID.String()
	}

	for _, projectSkill := range projectSkills {
		if projectSkill.ID == skillID {
			return projectSkill.Name
		}
	}

	slog.Warn(logContext+": Project skill for notification not found", "skillID", skillID)
	return skillID.String()
}

type addSkillToTaskRequest struct {
	SkillID uuid.UUID `json:"skillId"`
} // @name AddSkillToTaskRequest

// @Summary	Adds a skill to a task. Must be member of the project of the task.
// @Tags		task
// @Param		id path string true "Task ID"
// @Success	200
// @Failure	404 {object} ErrorResponse "task not found"
// @Failure	401	{object}	ErrorResponse	"unauthorized"
// @Failure	400 {object} ErrorResponse "task and skill are not in the same project"
// @Router		/tasks/{id}/add-skill [post]
func (h taskRouteHandler) taskAddSkill(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid task id"})
	}

	// check if user is allowed to access the task
	projIDOfTask, err := h.projectService.GetProjectIdByTaskId(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, projIDOfTask)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	var req addSkillToTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	// check if user is allowed to access the skill
	projIDOfSkill, err := h.projectService.GetProjectIdBySkillId(ctx, req.SkillID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err = h.projectService.IsProjectMember(ctx, userID, projIDOfSkill)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	taskSkill, err := h.taskService.AddSkill(ctx, taskID, req.SkillID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if err := routes.SendWSUpdate(ctx, h.rdb, projIDOfTask, routes.TaskSkillAdded, routes.TaskSkill{ID: taskSkill.ID, TaskID: taskID, ProjectSkillID: taskSkill.ID}); err != nil {
		slog.Error("taskAddSkillPOST: Failed to send ws update", "error", err)
	}

	skillName := h.projectSkillName(ctx, projIDOfTask, req.SkillID, "taskAddSkillPOST")
	updatedTask, err := h.taskService.GetTask(ctx, taskID)
	if err != nil {
		slog.Error("taskAddSkillPOST: Failed to get task for notification", "error", err)
	} else {
		h.notifyTaskAssignees(
			ctx,
			*updatedTask,
			userID,
			"task",
			taskID,
			taskSkillAddedNotificationMessage(*updatedTask, skillName),
			"taskAddSkillPOST",
		)
	}

	return c.NoContent(http.StatusOK)
}

type removeSkillFromTaskRequest struct {
	SkillID uuid.UUID `json:"skillId"`
} // @name RemoveSkillFromTaskRequest

// @Summary	Removes a skill from a task. Must be member of the project of the task.
// @Tags		task
// @Param		id path string true "Task ID"
// @Success	200
// @Failure	404 {object} ErrorResponse "task not found"
// @Failure	401	{object}	ErrorResponse	"unauthorized"
// @Failure	400 {object} ErrorResponse "task and skill are not in the same project"
// @Router		/tasks/{id}/remove-skill [post]
func (h taskRouteHandler) taskRemoveSkill(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid task id"})
	}

	// check if user is allowed to access the task
	projIDOfTask, err := h.projectService.GetProjectIdByTaskId(ctx, taskID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err := h.projectService.IsProjectMember(ctx, userID, projIDOfTask)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	var req removeSkillFromTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	// check if user is allowed to access the skill
	projIDOfSkill, err := h.projectService.GetProjectIdBySkillId(ctx, req.SkillID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isProjectMember, err = h.projectService.IsProjectMember(ctx, userID, projIDOfSkill)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isProjectMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	err = h.taskService.RemoveSkill(ctx, taskID, req.SkillID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}
	taskSkill := routes.TaskSkill{
		TaskID:         taskID,
		ProjectSkillID: req.SkillID,
	}
	if err := routes.SendWSUpdate(ctx, h.rdb, projIDOfTask, routes.TaskSkillRemoved, taskSkill); err != nil {
		slog.Error("taskRemoveSkillPOST: Failed to send ws update", "error", err)
	}

	skillName := h.projectSkillName(ctx, projIDOfTask, req.SkillID, "taskRemoveSkillPOST")
	updatedTask, err := h.taskService.GetTask(ctx, taskID)
	if err != nil {
		slog.Error("taskRemoveSkillPOST: Failed to get task for notification", "error", err)
	} else {
		h.notifyTaskAssignees(
			ctx,
			*updatedTask,
			userID,
			"task",
			taskID,
			taskSkillRemovedNotificationMessage(*updatedTask, skillName),
			"taskRemoveSkillPOST",
		)
	}

	return c.NoContent(http.StatusOK)
}

// @Summary	Get all tasks of a project. Must be member of the project.
// @Tags		task
// @Param		id	path		string			true	"Project ID"
// @Success	200	{array}		Task			"Tasks of a project"
// @Failure	404	{object}	ErrorResponse	"project not found"
// @Failure	401	{object}	ErrorResponse	"unauthorized"
// @Router		/tasks/for-project/{id} [get]
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

	mappedTasksOfProject := routes.Map(tasksOfProject, routes.MapTask)

	return c.JSON(http.StatusOK, mappedTasksOfProject)
}

// @Summary	Get all tasks of a project that are assigned to the authenticated user. Must be member of the project.
// @Tags		task
// @Param		id	path		string					true	"Project ID"
// @Success	200	{array}		TaskAssigneeWithTask	"Tasks of a project assigned to me"
// @Failure	404	{object}	ErrorResponse			"project not found"
// @Failure	401	{object}	ErrorResponse			"unauthorized"
// @Router		/tasks/for-project/{id}/my-tasks [get]
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

	mappedTasksOfProject := routes.Map(tasksOfProject, routes.MapTaskAssigneeWithTask)

	return c.JSON(http.StatusOK, mappedTasksOfProject)
}
