package auth

import (
	"backend/config"
	"backend/services/user"
	"context"
	"fmt"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	echojwt "github.com/labstack/echo-jwt/v5"
	"github.com/labstack/echo/v5"
)

const SessionTokenName = "sessionToken"

type (
	jwtTokenString string

	// Add custom jwt claims here, default claims are automatically embedded using [jwt.RegisteredClaims]
	jwtCustomClaims struct {
		UserID uuid.UUID `json:"userid"`
		jwt.RegisteredClaims
	}

	AuthService interface {
		AuthenticateUser(ctx context.Context, email, password string) (jwtTokenString, time.Time, error)
		AuthenticatedMiddleware() echo.MiddlewareFunc
		// should only be called in routes protected by [AuthenticatedMiddleware]
		// panics if no claims are found
		GetClaims(ctx *echo.Context) jwtCustomClaims
	}

	authService struct {
		userService               user.UserService
		cfg                       authenticationConfig
		isAuthenticatedMiddleware echo.MiddlewareFunc
	}

	authenticationConfig struct {
		sessionExpiryHours int
		sessionSecret      string
	}
)

func NewAuthenticationService(userService user.UserService) AuthService {
	cfg := loadAuthenticationConfig()
	return &authService{
		userService:               userService,
		cfg:                       cfg,
		isAuthenticatedMiddleware: createIsAuthenticatedMiddleware(cfg),
	}
}

// panics if no SESSION_SECRET environment variable is set
func loadAuthenticationConfig() authenticationConfig {
	return authenticationConfig{
		sessionExpiryHours: config.EnvInt("SESSION_EXPIRY_HOURS", 24),
		sessionSecret:      config.EnvStrMust("SESSION_SECRET"),
	}
}

func (s authService) AuthenticateUser(ctx context.Context, email, password string) (jwtTokenString, time.Time, error) {
	userId, err := s.userService.GetByEmailAndPassword(ctx, email, password)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("%w: %w", ErrUnauthorized, err)
	}

	expiry := s.expiresAtTime()
	claims := &jwtCustomClaims{
		UserID: userId,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiry),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	t, err := token.SignedString([]byte(s.cfg.sessionSecret))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to create a signed jwt string: %w", err)
	}

	return jwtTokenString(t), expiry, nil
}

func (s authService) AuthenticatedMiddleware() echo.MiddlewareFunc {
	return s.isAuthenticatedMiddleware
}

func (s authService) GetClaims(ctx *echo.Context) jwtCustomClaims {
	return getClaims(ctx)
}

func (s authService) expiresAtTime() time.Time {
	return time.Now().Add(time.Hour * time.Duration(s.cfg.sessionExpiryHours))
}

func getClaims(ctx *echo.Context) jwtCustomClaims {
	token, err := echo.ContextGet[*jwt.Token](ctx, "user")
	if err != nil {
		log.Fatalf("invalid call to GetClaims: %s", err.Error())
	}

	claims, ok := token.Claims.(*jwtCustomClaims)
	if claims == nil || !ok {
		log.Fatal("invalid call to GetClaims: no claims found")
	}
	return *claims
}

func echoJwtConfig(cfg authenticationConfig) echojwt.Config {
	config := echojwt.Config{
		NewClaimsFunc: func(c *echo.Context) jwt.Claims {
			return new(jwtCustomClaims)
		},
		SigningKey:  []byte(cfg.sessionSecret),
		TokenLookup: "cookie:" + SessionTokenName,
	}
	return config
}

func createIsAuthenticatedMiddleware(cfg authenticationConfig) echo.MiddlewareFunc {
	return echojwt.WithConfig(echoJwtConfig(cfg))
}
