package routes

import (
	"context"

	"backend/config"
	"errors"
	"log/slog"
	"net/http"

	"backend/models"

	authService "backend/services/auth"
	projectService "backend/services/project"
	userService "backend/services/user"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type userRouteHandler struct {
	userService     userService.UserService
	authService     authService.AuthService
	applicationMode config.ApplicationMode
	projectService  projectService.ProjectService
}

func NewUserRouteHandler(us userService.UserService, as authService.AuthService, ps projectService.ProjectService) *userRouteHandler {
	return &userRouteHandler{
		userService:     us,
		authService:     as,
		applicationMode: config.ApplicationModeFromEnv(),
		projectService:  ps,
	}
}

func (h userRouteHandler) AddRoutes(api *echo.Group) {
	if h.applicationMode.IsOpenNetwork() {
		api.POST("/users", h.userPOSTHandle, h.authService.AuthenticatedMiddleware(), h.superuserOnlyMiddleware())
	} else {
		api.POST("/users", h.userPOSTHandle)
	}

	g := api.Group("/users", h.authService.AuthenticatedMiddleware())
	g.GET("", h.usersGETHandle)
	g.GET("/:id", h.userGETHandle)
	g.PATCH("/:id", h.userPATCHHandle)
	g.PATCH("/:id/password", h.userPasswordPATCHHandle)
	if h.applicationMode.IsOpenNetwork() {
		g.PATCH("/:id/password/reset", h.userPasswordResetPATCHHandle, h.superuserOnlyMiddleware())
	}
	g.PUT("/:id/projects/:projectId/skills", h.userProjectSkillsPUTHandle)
	g.DELETE("/:id", h.userDELETEHandle)

	g.PATCH("/:id/projects/:projectId/working-hours", h.setWorkingHoursHandle)
	g.POST("/:id/projects/working-hours", h.setAllWorkingHoursHandle)
	g.POST("/:id/projects/:projectId/skills/:skill_id", h.addSkillHandle)
	g.DELETE("/:id/projects/:projectId/skills/:skill_id", h.removeSkillHandle)
	g.GET("/:id/projects/:projectId/skills", h.userSkillsGETHandle)
	g.GET("/:id/skills", h.userSkillsOLDGETHandle)
}

type createUserRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
} // @name CreateUserRequest

type setAllWorkingHoursRequest struct {
	ProjectID    uuid.UUID `json:"project_id"`
	WorkingHours int       `json:"working_hours"`
} // @name SetAllWorkingHoursRequest

type setWorkingHoursRequest struct {
	WorkingHours int `json:"working_hours" form:"working_hours"`
} // @name SetWorkingHoursRequest

type updateUserRequest struct {
	Email        *string `json:"email" form:"email"`
	FullName     *string `json:"full_name" form:"full_name"`
	RemoveAvatar *bool   `json:"remove_avatar" form:"remove_avatar"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" form:"current_password"`
	NewPassword     string `json:"new_password" form:"new_password"`
} //	@name	ChangePasswordRequest

type resetPasswordRequest struct {
	NewPassword string `json:"new_password" form:"new_password"`
} //	@name	ResetPasswordRequest

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
		errors.Is(err, userService.ErrPasswordMissingNumber),
		errors.Is(err, userService.ErrPasswordUnchanged),
		errors.Is(err, userService.ErrAvatarTooLarge),
		errors.Is(err, userService.ErrAvatarInvalidType),
		errors.Is(err, userService.ErrAvatarCorruptImage),
		errors.Is(err, userService.ErrWorkingHoursExceedLimit):
		return http.StatusBadRequest, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

func (h userRouteHandler) requestUserIsSuperuser(c *echo.Context) (bool, error) {
	callerID := h.authService.GetClaims(c).UserID
	u, err := h.userService.GetUser(c.Request().Context(), callerID)
	if err != nil {
		return false, err
	}
	return u.IsSuperuser, nil
}

func (h userRouteHandler) superuserOnlyMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			isSuperuser, err := h.requestUserIsSuperuser(c)
			if err != nil {
				status, msg := h.mapServiceError(err)
				return c.JSON(status, ErrorResponse{Error: msg})
			}
			if !isSuperuser {
				return c.JSON(http.StatusForbidden, ErrorResponse{Error: "superuser required"})
			}
			return next(c)
		}
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
func (h userRouteHandler) userSkillsOLDGETHandle(c *echo.Context) error {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	callerID := h.authService.GetClaims(c).UserID
	if callerID != userID {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	userProjects, err := h.projectService.GetAllProjects(context.Background(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal server error"})
	}

	var allSkills []models.ProjectSkill

	for _, proj := range userProjects {
		skills, err := h.userService.GetUserSkills(c.Request().Context(), userID, proj.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal server error"})
		}
		allSkills = append(allSkills, skills...)
	}

	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	mapped := []UserSkill{}
	for _, s := range allSkills {
		// map to UserSkill for response
		mapped = append(mapped, MapProjectSkillToUserSkill(s, userID))
	}

	return c.JSON(http.StatusOK, mapped)
}

// GET /users/:id/projects/:projectId/skills
//
//	@Summary	Get user skills (self only)
//	@Tags		users
//	@Param		id	path		string	true	"User ID (UUID)"
//	@Produce	json
//	@Success	200	{array}		ProjectSkill
//	@Failure	400	{object}	ErrorResponse	"invalid user id"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Failure	500	{object}	ErrorResponse	"internal server error"
//	@Router		/users/{id}/projects/{projectId}/skills [get]
func (h userRouteHandler) userSkillsGETHandle(c *echo.Context) error {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	callerID := h.authService.GetClaims(c).UserID
	if callerID != userID {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	userSkills, err := h.userService.GetUserSkills(c.Request().Context(), userID, projectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, Map(userSkills, MapProjectSkill))
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

	mapped := []UserSkill{}
	for _, s := range userSkills {
		// map to UserSkill for response
		mapped = append(mapped, MapProjectSkillToUserSkill(s, userID))
	}

	return c.JSON(http.StatusOK, mapped)
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

// PATCH /users/:id/password/reset
//
//	@Summary	Reset user password (superuser only)
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		id		path	string					true	"User ID (UUID)"
//	@Param		data	body	resetPasswordRequest	true	"New password"
//	@Success	204
//	@Failure	400	{object}	ErrorResponse	"invalid user id, request body, missing password, or weak new password"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Failure	403	{object}	ErrorResponse	"superuser required"
//	@Failure	404	{object}	ErrorResponse	"user not found"
//	@Router		/users/{id}/password/reset [patch]
func (h userRouteHandler) userPasswordResetPATCHHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}

	var req resetPasswordRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	if req.NewPassword == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "missing new_password"})
	}

	if _, err := h.userService.UpdateUser(c.Request().Context(), id, userService.UpdateUserInput{Password: &req.NewPassword}); err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}

// DELETE /users/:id
//
//	@Summary	Delete user
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
		if !h.applicationMode.IsOpenNetwork() {
			return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		}

		isSuperuser, err := h.requestUserIsSuperuser(c)
		if err != nil {
			status, msg := h.mapServiceError(err)
			return c.JSON(status, ErrorResponse{Error: msg})
		}
		if isSuperuser {
			if err := h.userService.DeleteUser(c.Request().Context(), id); err != nil {
				status, msg := h.mapServiceError(err)
				return c.JSON(status, ErrorResponse{Error: msg})
			}

			return c.NoContent(http.StatusNoContent)
		}
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	if h.applicationMode.IsOpenNetwork() {
		isSuperuser, err := h.requestUserIsSuperuser(c)
		if err != nil {
			status, msg := h.mapServiceError(err)
			return c.JSON(status, ErrorResponse{Error: msg})
		}
		if isSuperuser {
			return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "superuser cannot delete own account"})
		}
	}

	if err := h.userService.DeleteUser(c.Request().Context(), id); err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}

// PATCH /users/:id/projects/{projectId}/working-hours
//
//	@Summary    Set users weekly working hours for a project
//	@Tags       users, projects
//	@Param      id          path    string                  true  "User ID (UUID)"
//	@Param      projectId  path    string                  true  "Project ID (UUID)"
//	@Param      data        body    setWorkingHoursRequest  true  "Working hours data"
//	@Success    200 {object}    routes.ReturnMember
//	@Failure    400 {object}    ErrorResponse   "invalid id or request body"
//	@Failure    401 {object}    ErrorResponse   "unauthorized"
//	@Router     /users/{id}/projects/{projectId}/working-hours [patch]
func (h userRouteHandler) setWorkingHoursHandle(c *echo.Context) error {
	userID, err := uuid.Parse(c.Param("id"))
	projID, err2 := uuid.Parse(c.Param("projectId"))
	if err != nil || err2 != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user or project id"})
	}
	callerID := h.authService.GetClaims(c).UserID
	if callerID != userID {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	var req setWorkingHoursRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	pm, err := h.userService.SetWorkingHours(c.Request().Context(), projID, req.WorkingHours, userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, MapToReturnMember(*pm))
}

// POST /users/:id/projects/working-hours
//
//	@Summary    Set users weekly working hours for multiple projects
//	@Tags       users, projects
//	@Param      id          path    string                          true  "User ID (UUID)"
//	@Param      data        body    []SetAllWorkingHoursRequest  true  "List of working hours settings for multiple projects"
//	@Success    200 {object}    map[string]string   "message: working hours updated successfully"
func (h userRouteHandler) setAllWorkingHoursHandle(c *echo.Context) error {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user id"})
	}
	callerID := h.authService.GetClaims(c).UserID
	if callerID != userID {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	var req []setAllWorkingHoursRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	requests := make([]userService.SetAllWorkingHoursRequest, len(req))
	for i, r := range req {
		requests[i] = userService.SetAllWorkingHoursRequest{
			ProjectID:    r.ProjectID,
			WorkingHours: r.WorkingHours,
		}
	}

	err_set := h.userService.SetAllWorkingHours(c.Request().Context(), requests, callerID)
	if err_set != nil {
		status, msg := h.mapServiceError(err_set)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusOK)
}

// POST /users/:id/projects/:projectId/skills/:skill_id
//
//	@Summary    Add a Skill to a ProjectMember
//	@Tags       users, projects, skills
//	@Param      id          path    string  true  "User ID (UUID)"
//	@Param      projectId  path    string  true  "Project ID (UUID)"
//	@Param      skill_id    path    string  true  "Skill ID (UUID)"
//	@Success    200 {object}    routes.ReturnMember
//	@Failure    400 {object}    ErrorResponse   "invalid id format"
//	@Failure    401 {object}    ErrorResponse   "unauthorized"
//	@Router     /users/{id}/projects/{projectId}/skills/{skill_id} [post]
func (h userRouteHandler) addSkillHandle(c *echo.Context) error {
	userID, err := uuid.Parse(c.Param("id"))
	projID, err2 := uuid.Parse(c.Param("projectId"))
	skillID, err3 := uuid.Parse(c.Param("skill_id"))
	if err != nil || err2 != nil || err3 != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user, project, or skill id"})
	}

	callerID := h.authService.GetClaims(c).UserID
	if callerID != userID {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	pm, err := h.userService.AddSkill(c.Request().Context(), projID, skillID, userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, MapToReturnMember(*pm))
}

// DELETE /users/:id/projects/:projectId/skills/:skill_id
//
//	@Summary    Remove a Skill from a ProjectMember
//	@Tags       users, projects, skills
//	@Param      id          path    string  true  "User ID (UUID)"
//	@Param      projectId  path    string  true  "Project ID (UUID)"
//	@Param      skill_id    path    string  true  "Skill ID (UUID)"
//	@Success    200 {object}    routes.ReturnMember
//	@Failure    400 {object}    ErrorResponse   "invalid id format"
//	@Failure    401 {object}    ErrorResponse   "unauthorized"
//	@Router     /users/{id}/projects/{projectId}/skills/{skill_id} [delete]
func (h userRouteHandler) removeSkillHandle(c *echo.Context) error {
	userID, err := uuid.Parse(c.Param("id"))
	projID, err2 := uuid.Parse(c.Param("projectId"))
	skillID, err3 := uuid.Parse(c.Param("skill_id"))
	if err != nil || err2 != nil || err3 != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid user, project, or skill id"})
	}

	callerID := h.authService.GetClaims(c).UserID
	if callerID != userID {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	pm, err := h.userService.RemoveSkill(c.Request().Context(), projID, skillID, userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, MapToReturnMember(*pm))
}
