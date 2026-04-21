package routes

import (
	"backend/services/auth"
	"backend/services/user"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
)

type authRouteHandler struct {
	authService auth.AuthService
	userService user.UserService
}

func NewAuthRouteHandler(authService auth.AuthService, userService user.UserService) *authRouteHandler {
	return &authRouteHandler{authService, userService}
}

func (h authRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/auth")
	g.POST("/login", h.loginPOST)
	g.POST("/logout", h.logoutPOST)
	g.GET("/session", h.sessionGET, h.authService.AuthenticatedMiddleware())
}

func (h authRouteHandler) mapServiceError(err error) (int, string) {
	switch {
	case errors.Is(err, auth.ErrUnauthorized):
		return http.StatusUnauthorized, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

//	@Summary	Login using email and password
//	@Tags		auth
//	@Param		email		formData	string	true	"User email"
//	@Param		password	formData	string	true	"User password"
//	@Success	200
//	@Failure	400	{object}	ErrorResponse	"bad request"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Header		200	{string}	Set-Cookie		"sessionToken=<some-token>"
//	@Router		/auth/login [post]
func (h authRouteHandler) loginPOST(c *echo.Context) error {
	ctx := c.Request().Context()
	email := c.FormValue("email")
	password := c.FormValue("password")

	if email == "" || password == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "missing email or password"})
	}

	jwtTokenString, jwtExpiry, err := h.authService.AuthenticateUser(ctx, email, password)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	cookie := http.Cookie{
		Name:     auth.SessionTokenName,
		Value:    string(jwtTokenString),
		Expires:  jwtExpiry,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
	}
	c.SetCookie(&cookie)
	return c.NoContent(http.StatusOK)
}

//	@Summary	Logout
//	@Tags		auth
//	@Success	200
//	@Header		200	{string}	Set-Cookie	"sessionToken=<empty>,expires=1970-01-01"
//	@Router		/auth/logout [post]
func (h authRouteHandler) logoutPOST(c *echo.Context) error {
	cookie := http.Cookie{
		Name:     auth.SessionTokenName,
		Value:    "",
		Expires:  time.Unix(0, 0), // set past date to immediately remove cookie
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
	}
	c.SetCookie(&cookie)
	return c.NoContent(http.StatusOK)
}

//	@Summary	Get the currently logged-in user
//	@Tags		auth
//	@Success	200	{object}	User			"return the authenticated user"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Router		/auth/session [get]
func (h authRouteHandler) sessionGET(c *echo.Context) error {
	ctx := c.Request().Context()
	userID := h.authService.GetClaims(c).UserID
	user, err := h.userService.GetUser(ctx, userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	mappedUser := mapUser(*user)

	return c.JSON(http.StatusOK, mappedUser)
}
