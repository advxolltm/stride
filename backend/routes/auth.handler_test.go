package routes

import (
	"backend/testutils"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	userStore "backend/db/user"
	"backend/services/auth"
	authService "backend/services/auth"
	userService "backend/services/user"
)

var db *gorm.DB

func newTestAuthHandler(db *gorm.DB) authRouteHandler {
	userStore := userStore.NewUserStore(db)
	userService := userService.NewUserService(userStore)	
	authService := authService.NewAuthenticationService(userService)
	return authRouteHandler{
		authService,
	}
}

func TestMain(m *testing.M) {
	db = testutils.SetupDB()
	db = db.Begin()
	testutils.SeedDB(db)
	exitCode := m.Run()
	db.Rollback()
	testutils.TeardownDB()
	os.Exit(exitCode)
}

func TestAuthHandler(t *testing.T) {
	t.Setenv("SESSION_SECRET", "super-secret")

	runTest := func(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, authRouteHandler)) {
		t.Run(name, func(t *testing.T) {
			db.Transaction(func(tx *gorm.DB) error {
				f(t, tx, newTestAuthHandler(tx))
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	runTest(t, db, "-", func(t *testing.T, db *gorm.DB, sut authRouteHandler) {
		runTest(t, db, "Login", func(t *testing.T, db *gorm.DB, sut authRouteHandler) {
			runTest(t, db, "should return a bad-request on missing form data", func(t *testing.T, db *gorm.DB, sut authRouteHandler) {
				realUser := testutils.SelectRandomUser(t, db)
				e := echo.New()

				{
					formWithMissingPassword := make(url.Values)
					formWithMissingPassword.Set("email", realUser.Email)
					req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(formWithMissingPassword.Encode()))
					req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)

					rec := httptest.NewRecorder()
					c := e.NewContext(req, rec)

					err := sut.loginPOST(c)
					testutils.TAssertNoError(t, err)

					if rec.Code != http.StatusBadRequest {
						t.Errorf("rec.Code: expected %d, got: %d", http.StatusBadRequest, rec.Code)
					}

				}

				{
					formWithMissingMail := make(url.Values)
					formWithMissingMail.Set("password", "pwd")
					req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(formWithMissingMail.Encode()))
					req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)

					rec := httptest.NewRecorder()
					c := e.NewContext(req, rec)

					err := sut.loginPOST(c)
					testutils.TAssertNoError(t, err)

					if rec.Code != http.StatusBadRequest {
						t.Errorf("rec.Code: expected %d, got: %d", http.StatusBadRequest, rec.Code)
					}
				}

			})

			runTest(t, db, "should return unauthorized on a non existent user", func(t *testing.T, db *gorm.DB, sut authRouteHandler) {
				e := echo.New()
				realUser := testutils.SelectRandomUser(t, db)
				fakeUser := testutils.GenerateRandomUser()

				tests := []struct {
					email, password string
				}{
					{email: fakeUser.Email, password: testutils.GenerateUserPassword()}, // completely made up
					{email: realUser.Email, password: testutils.GenerateUserPassword()}, // email exists
					{email: fakeUser.Email, password: "pwd"},                            // password exists
				}

				for _, tt := range tests {
					form := make(url.Values)
					form.Set("email", tt.email)
					form.Set("password", tt.password)
					req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(form.Encode()))
					req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)

					rec := httptest.NewRecorder()
					c := e.NewContext(req, rec)

					err := sut.loginPOST(c)
					testutils.TAssertNoError(t, err)

					if rec.Code != http.StatusUnauthorized {
						t.Errorf("rec.Code: expected %d, got: %d", http.StatusBadRequest, rec.Code)
					}
				}
			})

			runTest(t, db, "should set a sessionToken cookie on success", func(t *testing.T, db *gorm.DB, sut authRouteHandler) {
				e := echo.New()
				realUser := testutils.SelectRandomUser(t, db)

				form := make(url.Values)
				form.Set("email", realUser.Email)
				form.Set("password", "pwd")
				req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(form.Encode()))
				req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)

				rec := httptest.NewRecorder()
				c := e.NewContext(req, rec)

				err := sut.loginPOST(c)
				testutils.TAssertNoError(t, err)

				if rec.Code != http.StatusOK {
					t.Errorf("rec.Code: expected %d, got: %d", http.StatusBadRequest, rec.Code)
				}

				if len(rec.Result().Cookies()) != 1 {
					t.Errorf("expected cookie to be set")
				} else {
					cookie := rec.Result().Cookies()[0]
					if cookie.Name != authService.SessionTokenName {
						t.Errorf("expected sessionToken cookie to be set")
					}
				} 
			})

			runTest(t, db, "logout should return a cookie with expiry set in the past", func(t *testing.T, db *gorm.DB, sut authRouteHandler) {
				e := echo.New()
				req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
				rec := httptest.NewRecorder()
				c := e.NewContext(req, rec)

				err := sut.logoutPOST(c)
				testutils.TAssertNoError(t, err)

				if rec.Code != http.StatusOK {
					t.Errorf("rec.Code: expected %d, got: %d", http.StatusBadRequest, rec.Code)
				}

				if len(rec.Result().Cookies()) != 1 {
					t.Errorf("expected cookie to be set")
				} 

				cookie := rec.Result().Cookies()[0]
				if cookie.Name != auth.SessionTokenName {
					t.Errorf("expected sessionToken cookie to be set")
				}

				now := time.Now()
				if cookie.Expires.After(now) || cookie.Expires.Equal(now) {
					t.Errorf("cookie expiry should be set in the past, got: %s", cookie.Expires)
				}
			})
		})
	})
}
