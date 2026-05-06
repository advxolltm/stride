package routes

import (
	"backend/models"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
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
		ID                      uuid.UUID      `json:"id"`
		ProjectID               uuid.UUID      `json:"project_id"`
		CreatedBy               uuid.UUID      `json:"created_by"`
		Title                   string         `json:"title"`
		Description             *string        `json:"description"`
		Status                  string         `json:"status"`
		StartDate               *time.Time     `json:"start_date"`
		DueDate                 *time.Time     `json:"due_date"`
		ExpectedDurationMinutes *int           `json:"expected_duration_minutes"`
		Position                int            `json:"position"`
		CreatedAt               time.Time      `json:"created_at"`
		UpdatedAt               time.Time      `json:"updated_at"`
		CompletedAt             *time.Time     `json:"completed_at"`
		TaskSkills              []TaskSkill    `json:"task_skills"`
		TaskAssignees           []TaskAssignee `json:"task_assignees"`
	} // @name Task

	TaskSkill struct {
		ID             uuid.UUID    `json:"id"`
		TaskID         uuid.UUID    `json:"task_id"`
		ProjectSkillID uuid.UUID    `json:"project_skill_id"`
		ProjectSkill   ProjectSkill `json:"project_skill"`
	} // @name TaskSkill

	ProjectSkill struct {
		ID          uuid.UUID `json:"id"`
		ProjectID   uuid.UUID `json:"project_id"`
		Name        string    `json:"name"`
		Description *string   `json:"description"`
	} // @name ProjectSkill

	TaskAssignee struct {
		ID              uuid.UUID     `json:"id"`
		TaskID          uuid.UUID     `json:"task_id"`
		ProjectMemberID uuid.UUID     `json:"project_member_id"`
		AssignedAt      time.Time     `json:"assigned_at"`
		ProjectMember   ProjectMember `json:"project_member"`
	} // @name TaskAssignee

	ProjectMember struct {
		ID        uuid.UUID `json:"id"`
		UserID    uuid.UUID `json:"user_id"`
		ProjectID uuid.UUID `json:"project_id"`
		Role      string    `json:"role"`
		JoinedAt  time.Time `json:"joined_at"`
		User      User      `json:"user"`
	} // @name ProjectMember

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
		TaskSkills:              Map(task.TaskSkills, MapTaskSkill),
		TaskAssignees:           Map(task.Assignees, MapTaskAssignee),
	}
}

func MapProjectSkill(projectSkill models.ProjectSkill) ProjectSkill {
	return ProjectSkill{
		ID:          projectSkill.ID,
		ProjectID:   projectSkill.ProjectID,
		Name:        projectSkill.Name,
		Description: projectSkill.Description,
	}
}

func MapTaskSkill(taskSkill models.TaskSkill) TaskSkill {
	return TaskSkill{
		ID:             taskSkill.ID,
		TaskID:         taskSkill.TaskID,
		ProjectSkillID: taskSkill.ProjectSkillID,
		ProjectSkill:   MapProjectSkill(taskSkill.ProjectSkill),
	}
}

func MapTaskAssignee(taskAssignee models.TaskAssignee) TaskAssignee {
	return TaskAssignee{
		ID:              taskAssignee.ID,
		TaskID:          taskAssignee.TaskID,
		ProjectMemberID: taskAssignee.ProjectMemberID,
		AssignedAt:      taskAssignee.AssignedAt,
		ProjectMember:   MapProjectMember(taskAssignee.ProjectMember),
	}
}

func MapProjectMember(projectMember models.ProjectMember) ProjectMember {
	return ProjectMember{
		ID:        projectMember.ID,
		UserID:    projectMember.UserID,
		ProjectID: projectMember.ProjectID,
		Role:      projectMember.Role,
		JoinedAt:  projectMember.JoinedAt,
		User:      MapUser(projectMember.User),
	}
}

func MapTaskAssigneeWithTask(taskAssignee models.TaskAssignee) TaskAssigneeWithTask {
	return TaskAssigneeWithTask{
		TaskAssignee: MapTaskAssignee(taskAssignee),
		Task:         MapTask(taskAssignee.Task),
	}
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

// Websocket Messages for live updates
type WSMessageType int

const (
	// Chat message types
	ChatMessageCreate WSMessageType = iota

	// Task message types
	TaskCreate
	TaskUpdate
	TaskDelete
	TaskMove
	TaskAssign
	TaskUnassign
	TaskSkillAdded
	TaskSkillRemoved

	// Project message types
	ProjectMemberAdd
	ProjectMemberRemove
	ProjectSkillAdd
	ProjectSkillRemove
)

type WSMessage[T any] struct {
	Type    WSMessageType `json:"type"`
	Payload T             `json:"payload"`
}

func validateWSMessageStruct(v reflect.Value) {
	c := v.Type()
	if !strings.HasPrefix(c.PkgPath(), "backend/routes") {
		panic(fmt.Sprintf("invalid type used for WSUpdate: %s", c.Name()))
	}

	for field := range c.Fields() {
		if !field.IsExported() {
			continue
		}

		jsonTag := field.Tag.Get("json")
		if jsonTag == "" {
			panic(fmt.Sprintf("field in type for WSUpdate does not have a json tag: %s->%s", c.Name(), field.Name))
		}
	}
}

func validateWSMessage[T any](payload T) {
	c := reflect.TypeOf(payload)
	if c.Kind() != reflect.Struct && c.Kind() != reflect.Array && c.Kind() != reflect.Slice {
		panic(fmt.Sprintf("WSUpdate payload must be a valid struct (or valid array of structs), but was: %s", c.Kind().String()))
	}

	v := reflect.ValueOf(payload)

	if v.Kind() == reflect.Slice || v.Kind() == reflect.Array {
		for i := 0; i < v.Len(); i++ {
			e := v.Index(i)
			validateWSMessageStruct(e)
		}
	} else {
		validateWSMessageStruct(v)
	}
}

func SendWSUpdate[T any](
	ctx context.Context,
	rdb *redis.Client,
	projectID uuid.UUID,
	t WSMessageType,
	payload T,
) error {
	validateWSMessage(payload)

	wsMsg := WSMessage[T]{
		Type:    t,
		Payload: payload,
	}
	msg, err := json.Marshal(wsMsg)
	if err != nil {
		return fmt.Errorf("failed to send ws update: %w", err)
	}

	res := rdb.Publish(ctx, projectID.String(), msg)
	if res.Err() != nil {
		return fmt.Errorf("failed to send ws update: %w", res.Err())
	}

	return nil
}
