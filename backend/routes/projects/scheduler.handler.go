package projects

import (
	"net/http"

	"backend/routes"
	authService "backend/services/auth"
	projectService "backend/services/project"
	schedulerService "backend/services/scheduler"
	taskService "backend/services/task"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type schedulerRouteHandler struct {
	schedulerService schedulerService.SchedulerService
	authService      authService.AuthService
	projectService   projectService.ProjectService
	taskService      taskService.TaskService
}

func newSchedulerRouteHandler(schs schedulerService.SchedulerService, as authService.AuthService, ps projectService.ProjectService, ts taskService.TaskService) *schedulerRouteHandler {
	return &schedulerRouteHandler{schedulerService: schs, authService: as, projectService: ps, taskService: ts}
}

func (h *schedulerRouteHandler) registerRoutes(g *echo.Group) {
	g.POST("/:id/scheduler", h.schedulerPOSTHandle)
	g.POST("/:id/scheduler/confirm", h.confirmPOSTHandle)
}

func mapToReturnAssignment(ass schedulerService.ReturnStruct) routes.AssignmentStruct {
	return routes.AssignmentStruct{
		NewAssignments: routes.Map(ass.NewAssignments, func(a schedulerService.Assignment) routes.ReturnAssignment {
			return routes.ReturnAssignment{
				UserID: a.UserID,
				TaskID: a.TaskID,
			}
		}),
		ChangedAssignments: routes.Map(ass.ChangedAssignments, func(a schedulerService.Assignment) routes.ReturnAssignment {
			return routes.ReturnAssignment{
				UserID: a.UserID,
				TaskID: a.TaskID,
			}
		}),
	}
}

type SchedulingSettings struct {
	OptimizationGoals []string `json:"optimization_goals"`
	TimeoutSeconds    *int     `json:"timeout_seconds,omitempty"`
}

type SchedulingRequest struct {
	TaskIDs []uuid.UUID `json:"task_ids"`
	UserIDs []uuid.UUID `json:"user_ids"`
	Settings SchedulingSettings `json:"settings"`
}

type SchedulingAssignment struct {
	UserID uuid.UUID `json:"user_id"`
	TaskID uuid.UUID `json:"task_id"`
}

// @Summary		Assign chosen unassigned tasks in a project
// @Description	Assign chosen unassigned task in a project to chosen Project Members
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			id		path		string				true	"Project ID"
// @Param			request	body		SchedulingRequest	true	"Scheduling details"
// @Success		200		{object}	[]routes.ReturnAssignment
// @Failure		400		{object}	routes.ErrorResponse	"invalid request body | invalid project id"
// @Failure		401		{object}	routes.ErrorResponse	"only project members can schedule for this project"
// @Failure		404		{object}	routes.ErrorResponse	"project not found"
// @Router			/projects/{id}/scheduler [post]
func (h *schedulerRouteHandler) schedulerPOSTHandle(c *echo.Context) error {
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
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only project members can schedule for this project"})
	}

	var req SchedulingRequest
	if c.Request().ContentLength > 0 {
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
		}
	}

	// combined path, check if empty post -- schedule project, else schedule specific tasks to specific users
	if len(req.TaskIDs) == 0 && len(req.UserIDs) == 0 {
		assignment, err_a := h.schedulerService.ScheduleProject(c.Request().Context(), id, schedulerService.Settings(req.Settings))
		if err_a != nil && assignment == nil {
			return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err_a.Error()})
		}
		return c.JSON(http.StatusOK, mapToReturnAssignment(*assignment))
	}

	assignment, err_a := h.schedulerService.ScheduleTasksToUsers(c.Request().Context(), schedulerService.SchedulingRequest{
		TaskIDs: req.TaskIDs,
		UserIDs: req.UserIDs,
		ProjID:  id,
	}, schedulerService.Settings(req.Settings))

	if err_a != nil && assignment == nil {
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err_a.Error()})
	}

	return c.JSON(http.StatusOK, mapToReturnAssignment(*assignment))
}

// @Summary		Confirm an Assignment
// @Description	Persist an assignment into the DB
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			id		path		string				true	"Project ID"
// @Param			request	body		[]routes.ReturnAssignment	true	"Assignments"
// @Success		201		{object}	[]routes.ReturnAssignment
// @Failure		400		{object}	routes.ErrorResponse	"invalid request body | invalid project id"
// @Failure		401		{object}	routes.ErrorResponse	"only project members can add skills to this project"
// @Failure		404		{object}	routes.ErrorResponse	"project not found"
// @Router			/projects/{id}/scheduler/confirm [post]
func (h *schedulerRouteHandler) confirmPOSTHandle(c *echo.Context) error {
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
	var req []SchedulingAssignment

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	var ret []routes.ReturnAssignment

	taskAssignments := make([]taskService.Assignment, len(req))
	for i, assignment := range req {
		member, err_m := h.projectService.GetProjectMember(c.Request().Context(), id, assignment.UserID)
		if err_m != nil {
			return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "failed to find a project user"})
		}

		task, err_t := h.taskService.GetTask(c.Request().Context(), assignment.TaskID)
		if err_t != nil {
			return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "failed to find task"})
		}

		for _, existingAssignee := range task.Assignees {
			if err := h.taskService.UnassignTask(
				c.Request().Context(),
				assignment.TaskID,
				existingAssignee.ProjectMemberID,
			); err != nil {
				return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "failed to replace task assignee"})
			}
		}

		taskAssignments[i] = taskService.Assignment{
			TaskID:          assignment.TaskID,
			ProjectMemberID: member.ID,
		}
	}

	assigned, err_a := h.taskService.AssignTaskBulk(c.Request().Context(), taskAssignments)
	if err_a != nil {
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: "failed to assign tasks"})
	}
	for _, a := range assigned {
		ret = append(ret, routes.ReturnAssignment{
			UserID: a.ProjectMember.User.ID,
			TaskID: a.TaskID,
		})
	}

	return c.JSON(http.StatusCreated, ret)

}
