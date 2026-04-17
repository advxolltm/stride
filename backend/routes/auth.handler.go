package routes

import (
	"backend/services/auth"
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"
)

// TODO: Tests auth.handler.go
type authRouteHandler struct {
	authService auth.AuthService
}

func NewAuthRouteHandler(authService auth.AuthService) *authRouteHandler {
	return &authRouteHandler{authService}
}

func (h authRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/auth")
	g.POST("/login", h.loginPOST)
}

func (h authRouteHandler) mapServiceError(err error) (int, string) {
	switch {
	case errors.Is(err, auth.ErrUnauthorized):
		return http.StatusUnauthorized, err.Error()
	default:
		// slog.Error("error", err.Error())
		return http.StatusInternalServerError, "internal server error"
	}
}

// POST /auth/login
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
		Name:     "sessionToken",
		Value:    string(jwtTokenString),
		Expires:  jwtExpiry,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	}
	c.SetCookie(&cookie)
	return c.NoContent(http.StatusOK)
}
