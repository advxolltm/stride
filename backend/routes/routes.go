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
	return res
}
func mapToReturnMemberP(mp *models.ProjectMember) ReturnMember {
	m := *mp
	res := ReturnMember{
		ID:        m.ID,
		UserID:    m.UserID,
		ProjectID: m.ProjectID,
		Role:      m.Role,
		JoinedAt:  m.JoinedAt,
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
	ID        uuid.UUID
	Username  string
	Email     string
	FullName  *string
	AvatarURL *string
}

type ReturnSkill struct {
	ID          uuid.UUID
	ProjectID   uuid.UUID
	Name        string
	Description *string
}

type ReturnProj struct {
	ID          uuid.UUID
	CreatedBy   *uuid.UUID
	Name        string
	Slug        string
	Description *string
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	JoinLink    *uuid.UUID

	Creator *ReturnUser
	Members []ReturnMember
	Skills  []ReturnSkill
}

type ReturnMember struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	ProjectID uuid.UUID
	Role      string
	JoinedAt  time.Time

	//User          User           `gorm:"foreignKey:UserID"`
}
