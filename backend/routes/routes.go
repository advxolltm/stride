package routes

import (
	"backend/models"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

// A general RouteHandler interface.
// Used to later iterate over all handlers, each adding their routes they handle, to the shared API group.
type RouteHandler interface {
	AddRoutes(api *echo.Group)
}

type ErrorResponse struct {
	Error string `json:"error"`
} // @name ErrorResponse

func BadRequestErrResponse(err error) ErrorResponse {
	var hErr *echo.HTTPError
	if ok := errors.As(err, &hErr); ok {
		return ErrorResponse{
			Error: fmt.Sprintf("bad request: %v", hErr),
		}
	} else {
		return ErrorResponse{
			Error: fmt.Sprintf("bad request: %s", err.Error()),
		}
	}
}

type DateOnly struct {
	time.Time
}

const dateLayout = "2006-01-02"

func (d *DateOnly) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)

	if s == "null" || s == "" {
		return nil
	}

	t, err := time.Parse(dateLayout, s)
	if err != nil {
		return err
	}

	d.Time = t
	return nil
}

func (d *DateOnly) ToTime() *time.Time {
	if d != nil {
		return &d.Time
	}
	return nil
}

func ToTimeOpt(d **DateOnly) **time.Time {
	if d == nil {
		return nil
	}

	if *d == nil {
		var t *time.Time
		return &t
	}

	res := (*d).ToTime()
	return &res
}

type (
	Task struct {
		ID                      uuid.UUID  `json:"id"`
		ProjectID               uuid.UUID  `json:"project_id"`
		CreatedBy               uuid.UUID  `json:"created_by"`
		Title                   string     `json:"title"`
		Description             *string    `json:"description"`
		Status                  string     `json:"status"`
		StartDate               *time.Time `json:"start_date"`
		DueDate                 *time.Time `json:"due_date"`
		ExpectedDurationMinutes *int       `json:"expected_duration_minutes"`
		Position                int        `json:"position"`
		CreatedAt               time.Time  `json:"created_at"`
		UpdatedAt               time.Time  `json:"updated_at"`
		CompletedAt             *time.Time `json:"completed_at"`
	} // @name Task

	TaskAssignee struct {
		ID              uuid.UUID `json:"id"`
		TaskID          uuid.UUID `json:"task_id"`
		ProjectMemberID uuid.UUID `json:"project_member_id"`
		AssignedAt      time.Time `json:"assigned_at"`
	} // @name TaskAssignee

	TaskAssigneeWithTask struct {
		TaskAssignee
		Task Task `json:"task"`
	} // @name TaskAssigneeWithTask
)

func MapTask(task models.Task) Task {
	return Task{
		ID:                      task.ID,
		ProjectID:               task.ProjectID,
		CreatedBy:               task.CreatedBy,
		Title:                   task.Title,
		Description:             task.Description,
		Status:                  task.Status,
		StartDate:               task.StartDate,
		DueDate:                 task.DueDate,
		ExpectedDurationMinutes: task.ExpectedDurationMinutes,
		Position:                task.Position,
		CreatedAt:               task.CreatedAt,
		UpdatedAt:               task.UpdatedAt,
		CompletedAt:             task.CompletedAt,
	}
}

func MapTaskAssignee(taskAssignee models.TaskAssignee) TaskAssignee {
	return TaskAssignee{
		ID:              taskAssignee.ID,
		TaskID:          taskAssignee.TaskID,
		ProjectMemberID: taskAssignee.ProjectMemberID,
		AssignedAt:      taskAssignee.AssignedAt,
	}
}

func MapTaskAssigneeWithTask(taskAssignee models.TaskAssignee) TaskAssigneeWithTask {
	return TaskAssigneeWithTask{
		TaskAssignee: MapTaskAssignee(taskAssignee),
		Task:         MapTask(taskAssignee.Task),
	}
}

func MapMany[T, V any](from []T, toFunc func(T) V) []V {
	res := make([]V, 0, len(from))
	for _, e := range from {
		res = append(res, toFunc(e))
	}
	return res
}

// Response types
type (
	User struct {
		ID        uuid.UUID `json:"id"`
		Username  string    `json:"username"`
		Email     string    `json:"email"`
		FullName  *string   `json:"full_name"`
		AvatarURL *string   `json:"avatar_url"`
	}
)

func MapUser(user models.User) User {
	return User{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		FullName:  user.FullName,
		AvatarURL: user.AvatarURL,
	}
}
