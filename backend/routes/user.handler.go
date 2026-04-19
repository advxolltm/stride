package routes

import (
	"errors"
	"net/http"

	authService "backend/services/auth"
	userService "backend/services/user"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)


type userRouteHandler struct {
	userService userService.UserService
	authService authService.AuthService
}

func NewUserRouteHandler(us userService.UserService, as authService.AuthService) *userRouteHandler {
	return &userRouteHandler{userService: us, authService: as}
}

func (h userRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/users")
	g.Use(h.authService.AuthenticatedMiddleware())
	g.GET("", h.usersGETHandle)
	g.GET("/:id", h.userGETHandle)
	g.POST("", h.userPOSTHandle)
	g.PATCH("/:id", h.userPATCHHandle)
	g.DELETE("/:id", h.userDELETEHandle)
}

type createUserRequest struct {
	Username	string	`json:"username"`
	Email		string	`json:"email"`
	Password	string	`json:"password"`
}

type updateUserRequest struct {
	Email		*string	`json:"email"`
	Password	*string	`json:"password"`
	FullName	*string	`json:"full_name"`
	AvatarURL	*string	`json:"avatar_url"`
}

func (h userRouteHandler) mapServiceError(err error) (int, string) {
	switch {
		case errors.Is(err, userService.ErrUserNotFound):
			return http.StatusNotFound, err.Error()
		case errors.Is(err, userService.ErrDuplicateEmail),
			errors.Is(err, userService.ErrDuplicateUsername):
			return http.StatusConflict, err.Error()
		case errors.Is(err, userService.ErrInvalidEmail),
			errors.Is(err, userService.ErrInvalidUsername),
			errors.Is(err, userService.ErrPasswordTooShort),
			errors.Is(err, userService.ErrPasswordMissingSpecial):
			return http.StatusBadRequest, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

// GET /users
func (h userRouteHandler) usersGETHandle(c *echo.Context) error {
	// TODO: add user-check

	users, err := h.userService.GetAllUsers(c.Request().Context())
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, users)
}

// GET /users/:id
func (h userRouteHandler) userGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	u, err := h.userService.GetUser(c.Request().Context(), id)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, u)
}

// POST /users
//	@Summary	Create user
//	@Tags		users
//	@Success	200
//	@Param		data	body	createUserRequest	true	"Create user data"
//	@Router		/users [post]
func (h userRouteHandler) userPOSTHandle(c *echo.Context) error {
	var req createUserRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}


	u, err := h.userService.CreateUser(c.Request().Context(), req.Username, req.Email, req.Password)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, u)
}

// PATCH /users/:id
func (h userRouteHandler) userPATCHHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	callerID := h.authService.GetClaims(c).UserID
	if callerID != id {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	var req updateUserRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	u, err := h.userService.UpdateUser(c.Request().Context(), id, userService.UpdateUserInput{
		Email:     req.Email,
		Password:  req.Password,
		FullName:  req.FullName,
		AvatarURL: req.AvatarURL,
	})
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, u)
}

// DELETE /users/:id
func (h userRouteHandler) userDELETEHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	callerID := h.authService.GetClaims(c).UserID
	if callerID != id {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	if err := h.userService.DeleteUser(c.Request().Context(), id); err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}
