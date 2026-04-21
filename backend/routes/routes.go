package routes

import (
	"backend/models"
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

func mapUser(user models.User) User {
	return User{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		FullName:  user.FullName,
		AvatarURL: user.AvatarURL,
	}
}
func mapToReturnProj(p models.Project) ReturnProj {
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
			AvatarURL: p.Creator.AvatarURL,
		}
	}
	if p.Members != nil {
		res.Members = Map(p.Members, mapToReturnMember)
	}
	if p.Skills != nil {
		res.Skills = Map(p.Skills, mapToReturnSkill)
	}

	return res
}

func mapToReturnMember(m models.ProjectMember) ReturnMember {
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
		AvatarURL: m.User.AvatarURL,
	}

	return res
}

func mapToReturnSkill(s models.ProjectSkill) ReturnSkill {
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
	ID        uuid.UUID `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	FullName  *string   `json:"full_name"`
	AvatarURL *string   `json:"avatar_url"`
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
