package routes

import (
	"errors"
	"log/slog"
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
	api.POST("/users", h.userPOSTHandle)
	g := api.Group("/users", h.authService.AuthenticatedMiddleware())
	g.GET("", h.usersGETHandle)
	g.GET("/:id", h.userGETHandle)
	g.GET("/:id/skills", h.userSkillsGETHandle)
	g.PATCH("/:id", h.userPATCHHandle)
	g.PATCH("/:id/password", h.userPasswordPATCHHandle)
	g.PUT("/:id/projects/:projectId/skills", h.userProjectSkillsPUTHandle)
	g.DELETE("/:id", h.userDELETEHandle)
}

type createUserRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
} //	@name	CreateUserRequest

type updateUserRequest struct {
	Email        *string `json:"email" form:"email"`
	FullName     *string `json:"full_name" form:"full_name"`
	RemoveAvatar *bool   `json:"remove_avatar" form:"remove_avatar"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" form:"current_password"`
	NewPassword     string `json:"new_password" form:"new_password"`
} //	@name	ChangePasswordRequest

type updateUserProjectSkillsRequest struct {
	ProjectSkillIDs []uuid.UUID `json:"project_skill_ids"`
} // @name UpdateUserProjectSkillsRequest

func (h userRouteHandler) mapServiceError(err error) (int, string) {
	switch {
	case errors.Is(err, userService.ErrUserNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, userService.ErrInvalidPassword):
		return http.StatusUnauthorized, err.Error()
	case errors.Is(err, userService.ErrDuplicateEmail),
		errors.Is(err, userService.ErrDuplicateUsername):
		return http.StatusConflict, err.Error()
	case errors.Is(err, userService.ErrProjectNotFound),
		errors.Is(err, userService.ErrProjectSkillNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, userService.ErrUserNotProjectMember):
		return http.StatusUnauthorized, err.Error()
	case errors.Is(err, userService.ErrInvalidEmail),
		errors.Is(err, userService.ErrInvalidUsername),
		errors.Is(err, userService.ErrPasswordTooShort),
		errors.Is(err, userService.ErrPasswordMissingSpecial),
		errors.Is(err, userService.ErrPasswordUnchanged),
		errors.Is(err, userService.ErrAvatarTooLarge),
		errors.Is(err, userService.ErrAvatarInvalidType),
		errors.Is(err, userService.ErrAvatarCorruptImage):
		return http.StatusBadRequest, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

// GET /users/:id/skills
//
//	@Summary	Get user skills (self only)
//	@Tags		users
//	@Param		id	path		string	true	"User ID (UUID)"
//	@Produce	json
//	@Success	200	{array}		UserSkill
//	@Failure	400	{object}	ErrorResponse	"invalid user id"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Failure	500	{object}	ErrorResponse	"internal server error"
//	@Router		/users/{id}/skills [get]
func (h userRouteHandler) userSkillsGETHandle(c *echo.Context) error {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	callerID := h.authService.GetClaims(c).UserID
	if callerID != userID {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	userSkills, err := h.userService.GetUserSkills(c.Request().Context(), userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, Map(userSkills, MapUserSkill))
}

// PUT /users/:id/projects/:projectId/skills
//
//	@Summary	Update user skills for a project (self only)
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string							true	"User ID (UUID)"
//	@Param		projectId	path		string							true	"Project ID"
//	@Param		data		body		updateUserProjectSkillsRequest	true	"Selected project skill IDs"
//	@Success	200			{array}		UserSkill
//	@Failure	400			{object}	ErrorResponse	"invalid user id, project id or request body"
//	@Failure	401			{object}	ErrorResponse	"unauthorized or user is not a project member"
//	@Failure	404			{object}	ErrorResponse	"project or project skill not found"
//	@Failure	500			{object}	ErrorResponse	"internal server error"
//	@Router		/users/{id}/projects/{projectId}/skills [put]
func (h userRouteHandler) userProjectSkillsPUTHandle(c *echo.Context) error {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	callerID := h.authService.GetClaims(c).UserID
	if callerID != userID {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	var req updateUserProjectSkillsRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	userSkills, err := h.userService.UpdateUserProjectSkills(c.Request().Context(), userID, projectID, req.ProjectSkillIDs)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, Map(userSkills, MapUserSkill))
}

// GET /users
//
//	@Summary	Get all users
//	@Tags		users
//	@Produce	json
//	@Success	200	{array}		User
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Failure	500	{object}	ErrorResponse	"internal server error"
//	@Router		/users [get]
func (h userRouteHandler) usersGETHandle(c *echo.Context) error {
	// TODO: add user-check

	users, err := h.userService.GetAllUsers(c.Request().Context())
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	mapped := make([]User, len(users))
	for i, u := range users {
		mapped[i] = MapUser(u)
	}
	return c.JSON(http.StatusOK, mapped)
}

// GET /users/:id
//
//	@Summary	Get user by ID
//	@Tags		users
//	@Produce	json
//	@Param		id	path		string	true	"User ID (UUID)"
//	@Success	200	{object}	User
//	@Failure	400	{object}	ErrorResponse	"invalid user id"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Failure	404	{object}	ErrorResponse	"user not found"
//	@Router		/users/{id} [get]
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

	return c.JSON(http.StatusOK, MapUser(*u))
}

// POST /users
//
//	@Summary	Create user
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		data	body		createUserRequest	true	"Create user data"
//	@Success	201		{object}	User
//	@Failure	400		{object}	ErrorResponse	"invalid request body"
//	@Failure	401		{object}	ErrorResponse	"unauthorized"
//	@Failure	409		{object}	ErrorResponse	"email or username already in use"
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

	return c.JSON(http.StatusCreated, MapUser(*u))
}

// PATCH /users/:id
//
//	@Summary		Update user (self only)
//	@Description	Updates user fields. When an avatar is uploaded, thumbnails (300x300, 600x600) and the original are saved. The response includes avatar_url with URLs for each resolution.
//	@Tags			users
//	@Accept			multipart/form-data
//	@Accept			json
//	@Produce		json
//	@Param			id			path		string	true	"User ID (UUID)"
//	@Param			email		formData	string	false	"New email"
//	@Param			full_name	formData	string	false	"Full name"
//	@Param			remove_avatar	formData	boolean	false	"Delete the current avatar and clear avatar_url"
//	@Param			avatar		formData	file	false	"Avatar image (jpeg, png, gif, webp; max 2MB). Generates 300x300, 600x600 thumbnails + original."
//	@Success		200			{object}	User
//	@Failure		400			{object}	ErrorResponse	"invalid user id, request body, avatar type, corrupt image, or file too large"
//	@Failure		401			{object}	ErrorResponse	"unauthorized"
//	@Failure		404			{object}	ErrorResponse	"user not found"
//	@Failure		409			{object}	ErrorResponse	"email already in use"
//	@Router			/users/{id} [patch]
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

	input := userService.UpdateUserInput{
		Email:        req.Email,
		FullName:     req.FullName,
		RemoveAvatar: req.RemoveAvatar != nil && *req.RemoveAvatar,
	}

	file, err := c.FormFile("avatar")
	if err == nil {
		src, err := file.Open()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to read uploaded file"})
		}
		defer func() {
			err := src.Close()
			if err != nil {
				slog.Error("failed to close avatar file", "error", err)
			}
		}()
		input.Avatar = &userService.AvatarInput{
			Filename: file.Filename,
			File:     src,
			Size:     file.Size,
		}
	}

	u, err := h.userService.UpdateUser(c.Request().Context(), id, input)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, MapUser(*u))
}

// PATCH /users/:id/password
//
//	@Summary	Change user password (self only)
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		id		path	string				true	"User ID (UUID)"
//	@Param		data	body	changePasswordRequest	true	"Current and new password"
//	@Success	204
//	@Failure	400	{object}	ErrorResponse	"invalid user id, request body, missing password, or weak new password"
//	@Failure	401	{object}	ErrorResponse	"unauthorized or invalid current password"
//	@Failure	404	{object}	ErrorResponse	"user not found"
//	@Router		/users/{id}/password [patch]
func (h userRouteHandler) userPasswordPATCHHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	callerID := h.authService.GetClaims(c).UserID
	if callerID != id {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	var req changePasswordRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "missing current_password or new_password"})
	}

	if err := h.userService.ChangePassword(c.Request().Context(), id, req.CurrentPassword, req.NewPassword); err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}

// DELETE /users/:id
//
//	@Summary	Delete user (self only)
//	@Tags		users
//	@Param		id	path	string	true	"User ID (UUID)"
//	@Success	204
//	@Failure	400	{object}	ErrorResponse	"invalid user id"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Router		/users/{id} [delete]
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
