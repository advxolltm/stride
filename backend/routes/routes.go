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
	AvatarURL struct {
		Small    string `json:"300"`
		Medium   string `json:"600"`
		Original string `json:"original"`
	}

	User struct {
		ID        uuid.UUID  `json:"id"`
		Username  string     `json:"username"`
		Email     string     `json:"email"`
		FullName  *string    `json:"full_name"`
		AvatarURL *AvatarURL `json:"avatar_url"`
	}
)


func mapAvatarURL(a *models.AvatarURLMap) *AvatarURL {
	if a == nil {
		return nil
	}
	return &AvatarURL{
		Small:    a.Small,
		Medium:   a.Medium,
		Original: a.Original,
	}
}

func MapUser(user models.User) User {
	var avatar *AvatarURL
	if user.AvatarURL != nil {
		avatar = &AvatarURL{
			Small:    user.AvatarURL.Small,
			Medium:   user.AvatarURL.Medium,
			Original: user.AvatarURL.Original,
		}
	}
	return User{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		FullName:  user.FullName,
		AvatarURL: avatar,
	}
}
func MapToReturnProj(p models.Project) ReturnProj {
	res := ReturnProj{
		ID:          p.ID,
		CreatedBy:   p.CreatedBy,
		Name:        p.Name,
		Slug:        p.Slug,
		Description: p.Description,
		Status:      p.Status,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
		JoinLink:    p.JoinLink,
	}

	if p.Creator != nil {
		res.Creator = &ReturnUser{
			ID:        p.Creator.ID,
			Username:  p.Creator.Username,
			Email:     p.Creator.Email,
			FullName:  p.Creator.FullName,
			AvatarURL: mapAvatarURL(p.Creator.AvatarURL),
		}
	}
	if p.Members != nil {
		res.Members = Map(p.Members, MapToReturnMember)
	}
	if p.Skills != nil {
		res.Skills = Map(p.Skills, MapToReturnSkill)
	}

	return res
}

func MapToReturnMember(m models.ProjectMember) ReturnMember {
	res := ReturnMember{
		ID:        m.ID,
		UserID:    m.UserID,
		ProjectID: m.ProjectID,
		Role:      m.Role,
		JoinedAt:  m.JoinedAt,
	}

	res.User = &ReturnUser{
		ID:        m.User.ID,
		Username:  m.User.Username,
		Email:     m.User.Email,
		FullName:  m.User.FullName,
		AvatarURL: mapAvatarURL(m.User.AvatarURL),
	}

	return res
}

func MapToReturnSkill(s models.ProjectSkill) ReturnSkill {
	res := ReturnSkill{
		ID:          s.ID,
		ProjectID:   s.ProjectID,
		Name:        s.Name,
		Description: s.Description,
	}
	return res
}

func Map[T any, V any](input []T, f func(T) V) []V {
	result := make([]V, len(input))
	for i, v := range input {
		result[i] = f(v)
	}
	return result
}

type ReturnUser struct {
	ID        uuid.UUID  `json:"id"`
	Username  string     `json:"username"`
	Email     string     `json:"email"`
	FullName  *string    `json:"full_name"`
	AvatarURL *AvatarURL `json:"avatar_url"`
}

type ReturnSkill struct {
	ID          uuid.UUID `json:"id"`
	ProjectID   uuid.UUID `json:"project_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
}

type ReturnProj struct {
	ID          uuid.UUID  `json:"id"`
	CreatedBy   *uuid.UUID `json:"created_by"`
	Name        string     `json:"name"`
	Slug        string     `json:"slug"`
	Description *string    `json:"description"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	JoinLink    *uuid.UUID `json:"join_link"`

	Creator *ReturnUser    `json:"creator,omitempty"`
	Members []ReturnMember `json:"members,omitempty"`
	Skills  []ReturnSkill  `json:"skills,omitempty"`
}

type ReturnMember struct {
	ID        uuid.UUID   `json:"id"`
	UserID    uuid.UUID   `json:"user_id"`
	ProjectID uuid.UUID   `json:"project_id"`
	Role      string      `json:"role"`
	JoinedAt  time.Time   `json:"joined_at"`
	User      *ReturnUser `json:"user,omitempty"`
}
