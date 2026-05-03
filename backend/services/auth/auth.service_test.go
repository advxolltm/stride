package auth

import (
	userStore "backend/db/user"
	userService "backend/services/user"
	"backend/testutils"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"testing/synctest"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/echotest"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const testSessionExpiryHours = 1
const testSessionSecret = "test-secret"

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

func newTestAuthService(db *gorm.DB) authService {
	userStore := userStore.NewUserStore(db)
	userService := userService.NewUserService(userStore)
	cfg := authenticationConfig{
		sessionExpiryHours: testSessionExpiryHours,
		sessionSecret:      testSessionSecret,
	}
	return authService{
		userService:               userService,
		cfg:                       cfg,
		isAuthenticatedMiddleware: createIsAuthenticatedMiddleware(cfg),
	}
}

func TestAuthService(t *testing.T) {
	runTest := func(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, authService)) {
		t.Run(name, func(t *testing.T) {
			_ = db.Transaction(func(tx *gorm.DB) error {
				f(t, tx, newTestAuthService(tx))
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	runTest(t, db, "-", func(t *testing.T, db *gorm.DB, sut authService) {
		// Setup: 2 (stored) users with different emails and passwords
		realUsers := testutils.SelectRandomUsers(t, db, 2)

		realUser1Pwd := "pwd"
		realUser1 := realUsers[0]

		realUser2Pwd := testutils.GenerateUserPassword()
		realUser2 := realUsers[1]

		// TODO: replace with testutils call
		_, err := sut.userService.UpdateUser(t.Context(), realUser2.ID, userService.UpdateUserInput{
			Password: &realUser2Pwd,
		})
		testutils.AssertNoError(err)

		runTest(t, db, "A non existent user should not get authenticated", func(t *testing.T, db *gorm.DB, sut authService) {
			runTest(t, db, "non existent email and password", func(t *testing.T, db *gorm.DB, sut authService) {
				fakeUser := testutils.GenerateRandomUser()
				_, _, err := sut.AuthenticateUser(t.Context(), fakeUser.Email, fakeUser.PasswordHash)

				if !errors.Is(err, ErrUnauthorized) {
					t.Errorf("expected unauthorized error, got: %v", err)
				}
				if !errors.Is(err, ErrInvalidCredentials) {
					t.Errorf("expected invalid credentials error, got: %v", err)
				}
			})

			runTest(t, db, "real email, non existent password", func(t *testing.T, db *gorm.DB, sut authService) {
				fakeUser := testutils.GenerateRandomUser()
				_, _, err := sut.AuthenticateUser(t.Context(), realUser1.Email, fakeUser.PasswordHash)

				if !errors.Is(err, ErrUnauthorized) {
					t.Errorf("expected unauthorized error, got: %v", err)
				}
				if !errors.Is(err, ErrInvalidCredentials) {
					t.Errorf("expected invalid credentials error, got: %v", err)
				}
			})

			runTest(t, db, "real password, non existent email", func(t *testing.T, db *gorm.DB, sut authService) {
				fakeUser := testutils.GenerateRandomUser()
				_, _, err := sut.AuthenticateUser(t.Context(), fakeUser.Email, realUser1Pwd)

				if !errors.Is(err, ErrUnauthorized) {
					t.Errorf("expected unauthorized error, got: %v", err)
				}
				if !errors.Is(err, ErrInvalidCredentials) {
					t.Errorf("expected invalid credentials error, got: %v", err)
				}
			})

			runTest(t, db, "real email and password, but from different users", func(t *testing.T, db *gorm.DB, sut authService) {
				_, _, err := sut.AuthenticateUser(t.Context(), realUser1.Email, realUser2Pwd)

				if !errors.Is(err, ErrUnauthorized) {
					t.Errorf("expected unauthorized error, got: %v", err)
				}
				if !errors.Is(err, ErrInvalidCredentials) {
					t.Errorf("expected invalid credentials error, got: %v", err)
				}
			})
		})

		runTest(t, db, "An existing user should get authenticated", func(t *testing.T, db *gorm.DB, sut authService) {
			tokenString, tokenExpiry, err := sut.AuthenticateUser(t.Context(), realUser1.Email, realUser1Pwd)
			testutils.TAssertNoError(t, err)

			if tokenString == "" {
				t.Error("AuthenticateUser did not return a valid token")
			}

			if tokenExpiry.IsZero() {
				t.Error("AuthenticateUser did not return a valid token expiry date")
			}

			runTest(t, db, "An auth-token authenticates a user", func(t *testing.T, db *gorm.DB, sut authService) {
				token, err := jwt.ParseWithClaims(string(tokenString), &jwtCustomClaims{}, func(t *jwt.Token) (any, error) {
					return []byte(sut.cfg.sessionSecret), nil
				})

				testutils.TAssertNoError(t, err)
				require.NotNil(t, token, "token did not get successfully parsed")
				require.NotNil(t, token.Claims, "claims did not get successfully parsed")

				claims, ok := token.Claims.(*jwtCustomClaims)
				testutils.Assert(ok)

				if claims.UserID != realUser1.ID {
					t.Errorf("expected user id %s, got %s", realUser1.ID, claims.UserID)
				}
			})

			runTest(t, db, "Expired auth-tokens do not authenticate a user", func(t *testing.T, db *gorm.DB, sut authService) {
				// synctest allows testing time-related cases more easily
				synctest.Test(t, func(t *testing.T) {
					// simulate waiting just after token expired
					time.Sleep(time.Until(tokenExpiry))

					_, err := jwt.ParseWithClaims(string(tokenString), &jwtCustomClaims{}, func(t *jwt.Token) (any, error) {
						return []byte(sut.cfg.sessionSecret), nil
					})

					if err == nil {
						t.Error("token should have expired")
					}
				})
			})

			runTest(t, db, "The auth middleware", func(t *testing.T, db *gorm.DB, sut authService) {
				runTest(t, db, "authenticates the user if a sessionToken is set", func(t *testing.T, db *gorm.DB, sut authService) {
					handler := func(c *echo.Context) error {
						claims := sut.GetClaims(c)
						return c.String(http.StatusTeapot, claims.UserID.String())
					}
					middleware := sut.AuthenticatedMiddleware()

					c, rec := echotest.ContextConfig{}.ToContextRecorder(t)
					c.Request().AddCookie(&http.Cookie{
						Name:    "sessionToken",
						Value:   string(tokenString),
						Expires: tokenExpiry,
					})

					err := middleware(handler)(c)
					testutils.TAssertNoError(t, err)

					if rec.Code != http.StatusTeapot {
						t.Errorf("rec.Code: expected %d, got: %d", http.StatusTeapot, rec.Code)
					}

					if rec.Body.String() != realUser1.ID.String() {
						t.Errorf("rec.Body.String(): expected %s, got: %s", rec.Body.String(), realUser1.ID.String())
					}
				})

				runTest(t, db, "errors if no sessionToken is set", func(t *testing.T, db *gorm.DB, sut authService) {
					handler := func(c *echo.Context) error {
						claims := sut.GetClaims(c)
						return c.String(http.StatusTeapot, claims.UserID.String())
					}
					middleware := sut.AuthenticatedMiddleware()

					c := echotest.ContextConfig{}.ToContext(t)

					err := middleware(handler)(c)
					if err == nil {
						t.Error("expected middleware to error")
					}
				})
			})
		})

	})
}
