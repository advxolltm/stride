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

func Map[T any, V any](input []T, f func(T) V) []V {
    result := make([]V, len(input))
    for i, v := range input {
        result[i] = f(v)
    }
    return result
}

type returnUser struct {
	ID           uuid.UUID
	Username     string
	Email        string
	FullName     *string
	AvatarURL    *string
}

type returnProj struct {
	ID           uuid.UUID
	CreatedBy   *uuid.UUID
	Name        string
	Slug        string
	Description *string
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	JoinLink    *uuid.UUID

	Creator     *returnUser
}
