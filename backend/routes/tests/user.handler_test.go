package routes_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	projectStore "backend/db/project"
	userStore "backend/db/user"
	"backend/models"
	"backend/routes"
	authService "backend/services/auth"
	projectService "backend/services/project"
	userService "backend/services/user"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUserRouteHandler_Integration(t *testing.T) {
	os.Setenv("SESSION_SECRET", "secretsecret")

	runTest := func(t *testing.T, name string, f func(*testing.T, *gorm.DB)) {
		t.Run(name, func(t *testing.T) {
			db.Transaction(func(tx *gorm.DB) error {
				f(t, tx)
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	pStore := projectStore.NewProjectStore(db)
	pServe := projectService.NewProjectService(pStore)
	uStore := userStore.NewUserStore(db)
	uServe := userService.NewUserService(uStore)
	aServ := authService.NewAuthenticationService(uServe, pServe)

	ctx := context.Background()
	email := "userhandler@test.com"
	pass := "Password123!"

	testUser, err := uServe.CreateUser(ctx, "userhandlertest", email, pass)
	require.NoError(t, err)

	globalCookie := getCookie(t, aServ, email, pass)

	handler := routes.NewUserRouteHandler(uServe, aServ)

	e := echo.New()
	api := e.Group("/api")
	handler.AddRoutes(api)

	// ── GET /users ──────────────────────────────────────────────────

	runTest(t, "GET /users returns 200 with auth", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var users []models.User
		err := json.Unmarshal(rec.Body.Bytes(), &users)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(users), 1)
	})

	runTest(t, "GET /users returns 401 without auth", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// ── GET /users/:id ──────────────────────────────────────────────

	runTest(t, "GET /users/:id returns 200 for existing user", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/users/"+testUser.ID.String(), nil)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var u models.User
		err := json.Unmarshal(rec.Body.Bytes(), &u)
		require.NoError(t, err)
		assert.Equal(t, testUser.ID, u.ID)
	})

	runTest(t, "GET /users/:id returns 400 on invalid UUID", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/users/not-a-uuid", nil)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "GET /users/:id returns 404 for non-existent user", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/users/"+uuid.New().String(), nil)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	runTest(t, "GET /users/:id returns 401 without auth", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/users/"+testUser.ID.String(), nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// ── POST /users ─────────────────────────────────────────────────

	runTest(t, "POST /users returns 201 on valid create", func(t *testing.T, _ *gorm.DB) {
		body := map[string]string{
			"username": "newuser123",
			"email":    "newuser123@test.com",
			"password": "Str0ng!Pass",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusCreated, rec.Code)

		var u models.User
		err := json.Unmarshal(rec.Body.Bytes(), &u)
		require.NoError(t, err)
		assert.Equal(t, "newuser123", u.Username)
		assert.Equal(t, "newuser123@test.com", u.Email)
	})

	runTest(t, "POST /users returns 400 on invalid body", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader([]byte("bad")))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "POST /users returns 401 without auth", func(t *testing.T, _ *gorm.DB) {
		body := map[string]string{
			"username": "noauth",
			"email":    "noauth@test.com",
			"password": "Str0ng!Pass",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// ── PATCH /users/:id ────────────────────────────────────────────

	runTest(t, "PATCH /users/:id returns 200 when updating self", func(t *testing.T, _ *gorm.DB) {
		newName := "Updated Name"
		body := map[string]string{"full_name": newName}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+testUser.ID.String(), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var u models.User
		err := json.Unmarshal(rec.Body.Bytes(), &u)
		require.NoError(t, err)
		assert.Equal(t, newName, *u.FullName)
	})

	runTest(t, "PATCH /users/:id returns 401 when updating another user", func(t *testing.T, _ *gorm.DB) {
		otherID := uuid.New()
		body := map[string]string{"full_name": "Hacker"}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+otherID.String(), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	runTest(t, "PATCH /users/:id returns 400 on invalid UUID", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodPatch, "/api/users/bad-uuid", bytes.NewReader([]byte("{}")))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "PATCH /users/:id returns 401 without auth", func(t *testing.T, _ *gorm.DB) {
		body := map[string]string{"full_name": "No Auth"}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+testUser.ID.String(), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// ── DELETE /users/:id ───────────────────────────────────────────

	runTest(t, "DELETE /users/:id returns 401 when deleting another user", func(t *testing.T, _ *gorm.DB) {
		otherID := uuid.New()
		req := httptest.NewRequest(http.MethodDelete, "/api/users/"+otherID.String(), nil)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	runTest(t, "DELETE /users/:id returns 400 on invalid UUID", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodDelete, "/api/users/bad-uuid", nil)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "DELETE /users/:id returns 401 without auth", func(t *testing.T, _ *gorm.DB) {
		req := httptest.NewRequest(http.MethodDelete, "/api/users/"+testUser.ID.String(), nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// DELETE self tested last — destroys test user's session
	runTest(t, "DELETE /users/:id returns 204 when deleting self", func(t *testing.T, _ *gorm.DB) {
		// Create a throwaway user to delete
		delUser, err := uServe.CreateUser(ctx, "deleteMe", "deleteme@test.com", "Delete1!")
		require.NoError(t, err)
		delCookie := getCookie(t, aServ, "deleteme@test.com", "Delete1!")

		req := httptest.NewRequest(http.MethodDelete, "/api/users/"+delUser.ID.String(), nil)
		req.AddCookie(delCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)
	})
}
