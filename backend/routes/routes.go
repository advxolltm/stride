package routes

import (
	"backend/models"

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

func mapUser(user models.User) User {
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
