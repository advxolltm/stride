package routes_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
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

// userResponse mirrors routes.User for test deserialization
type userResponse struct {
	ID        string            `json:"id"`
	Username  string            `json:"username"`
	Email     string            `json:"email"`
	FullName  *string           `json:"full_name"`
	AvatarURL *avatarURLResponse `json:"avatar_url"`
}

type avatarURLResponse struct {
	Small    string `json:"300"`
	Medium   string `json:"600"`
	Original string `json:"original"`
}

type userTestEnv struct {
	ctx          context.Context
	e            *echo.Echo
	testUser     *models.User
	globalCookie *http.Cookie
	uServe       userService.UserService
	aServ        authService.AuthService
}

func newUserTestEnv(t *testing.T, tx *gorm.DB) userTestEnv {
	t.Helper()

	pStore := projectStore.NewProjectStore(tx)
	pServe := projectService.NewProjectService(pStore)
	uStore := userStore.NewUserStore(tx)
	uServe := userService.NewUserService(uStore)
	aServ := authService.NewAuthenticationService(uServe, pServe)

	ctx := context.Background()
	email := fmt.Sprintf("userhandler-%s@test.com", uuid.NewString())
	username := fmt.Sprintf("userhandlertest-%s", uuid.NewString()[:8])
	pass := "Password123!"

	testUser, err := uServe.CreateUser(ctx, username, email, pass)
	require.NoError(t, err)

	handler := routes.NewUserRouteHandler(uServe, aServ)
	e := echo.New()
	api := e.Group("/api")
	handler.AddRoutes(api)

	return userTestEnv{
		ctx:          ctx,
		e:            e,
		testUser:     testUser,
		globalCookie: getCookie(t, aServ, email, pass),
		uServe:       uServe,
		aServ:        aServ,
	}
}

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

	// ── GET /users ──────────────────────────────────────────────────

	runTest(t, "GET /users returns 200 with auth", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		var users []userResponse
		err := json.Unmarshal(rec.Body.Bytes(), &users)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(users), 1)
	})

	runTest(t, "GET /users returns 401 without auth", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// ── GET /users/:id ──────────────────────────────────────────────

	runTest(t, "GET /users/:id returns 200 for existing user", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodGet, "/api/users/"+env.testUser.ID.String(), nil)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		var u userResponse
		err := json.Unmarshal(rec.Body.Bytes(), &u)
		require.NoError(t, err)
		assert.Equal(t, env.testUser.ID.String(), u.ID)
	})

	runTest(t, "GET /users/:id returns 400 on invalid UUID", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodGet, "/api/users/not-a-uuid", nil)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "GET /users/:id returns 404 for non-existent user", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodGet, "/api/users/"+uuid.New().String(), nil)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	runTest(t, "GET /users/:id returns 401 without auth", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodGet, "/api/users/"+env.testUser.ID.String(), nil)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// ── POST /users ─────────────────────────────────────────────────

	runTest(t, "POST /users returns 201 on valid create", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		body := map[string]string{
			"username": "newuser123",
			"email":    "newuser123@test.com",
			"password": "Str0ng!Pass",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusCreated, rec.Code)

		var u userResponse
		err := json.Unmarshal(rec.Body.Bytes(), &u)
		require.NoError(t, err)
		assert.Equal(t, "newuser123", u.Username)
		assert.Equal(t, "newuser123@test.com", u.Email)
	})

	runTest(t, "POST /users returns 400 on invalid body", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader([]byte("bad")))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "POST /users returns 401 without auth", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		body := map[string]string{
			"username": "noauth",
			"email":    "noauth@test.com",
			"password": "Str0ng!Pass",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// ── PATCH /users/:id ────────────────────────────────────────────

	runTest(t, "PATCH /users/:id returns 200 when updating self", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		newName := "Updated Name"
		body := map[string]string{"full_name": newName}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String(), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		var u userResponse
		err := json.Unmarshal(rec.Body.Bytes(), &u)
		require.NoError(t, err)
		require.NotNil(t, u.FullName)
		assert.Equal(t, newName, *u.FullName)
	})

	runTest(t, "PATCH /users/:id returns 401 when updating another user", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		otherID := uuid.New()
		body := map[string]string{"full_name": "Hacker"}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+otherID.String(), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	runTest(t, "PATCH /users/:id returns 400 on invalid UUID", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/bad-uuid", bytes.NewReader([]byte("{}")))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "PATCH /users/:id returns 401 without auth", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		body := map[string]string{"full_name": "No Auth"}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String(), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// ── DELETE /users/:id ───────────────────────────────────────────

	runTest(t, "DELETE /users/:id returns 401 when deleting another user", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		otherID := uuid.New()
		req := httptest.NewRequest(http.MethodDelete, "/api/users/"+otherID.String(), nil)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	runTest(t, "DELETE /users/:id returns 400 on invalid UUID", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodDelete, "/api/users/bad-uuid", nil)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "DELETE /users/:id returns 401 without auth", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodDelete, "/api/users/"+env.testUser.ID.String(), nil)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// DELETE self tested last — destroys test user's session
	runTest(t, "DELETE /users/:id returns 204 when deleting self", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		// Create a throwaway user to delete
		delUser, err := env.uServe.CreateUser(env.ctx, "deleteMe", "deleteme@test.com", "Delete1!")
		require.NoError(t, err)
		delCookie := getCookie(t, env.aServ, "deleteme@test.com", "Delete1!")

		req := httptest.NewRequest(http.MethodDelete, "/api/users/"+delUser.ID.String(), nil)
		req.AddCookie(delCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusNoContent, rec.Code)
	})

	// ── PATCH /users/:id with avatar ────────────────────────────────

	runTest(t, "PATCH /users/:id returns 200 with avatar upload and generates thumbnails", func(t *testing.T, tx *gorm.DB) {
		t.Setenv("MEDIA_DIR", t.TempDir())
		env := newUserTestEnv(t, tx)

		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)

		require.NoError(t, writer.WriteField("full_name", "Avatar User"))

		part, err := writer.CreateFormFile("avatar", "photo.png")
		require.NoError(t, err)
		// 1x1 transparent PNG
		pngData := []byte{
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
			0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
			0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
			0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
			0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
			0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00,
			0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
			0x60, 0x82,
		}
		_, err = part.Write(pngData)
		require.NoError(t, err)
		require.NoError(t, writer.Close())

		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String(), &buf)
		req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		var u userResponse
		err = json.Unmarshal(rec.Body.Bytes(), &u)
		require.NoError(t, err)
		require.NotNil(t, u.AvatarURL)
		require.NotNil(t, u.FullName)
		assert.Contains(t, u.AvatarURL.Small, "/media/avatars/")
		assert.Contains(t, u.AvatarURL.Small, "/300.png")
		assert.Contains(t, u.AvatarURL.Medium, "/600.png")
		assert.Contains(t, u.AvatarURL.Original, "/original.png")
		assert.Equal(t, "Avatar User", *u.FullName)
	})

	runTest(t, "PATCH /users/:id returns 400 on invalid avatar file type", func(t *testing.T, tx *gorm.DB) {
		t.Setenv("MEDIA_DIR", t.TempDir())
		env := newUserTestEnv(t, tx)

		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		part, err := writer.CreateFormFile("avatar", "malware.exe")
		require.NoError(t, err)
		_, err = part.Write([]byte("not an image"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())

		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String(), &buf)
		req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "PATCH /users/:id returns 400 on corrupt image (valid extension, invalid content)", func(t *testing.T, tx *gorm.DB) {
		t.Setenv("MEDIA_DIR", t.TempDir())
		env := newUserTestEnv(t, tx)

		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		part, err := writer.CreateFormFile("avatar", "fake.png")
		require.NoError(t, err)
		_, err = part.Write([]byte("this is not a valid PNG image file content"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())

		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String(), &buf)
		req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "PATCH /users/:id returns 200 without avatar (fields only)", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		require.NoError(t, writer.WriteField("full_name", "No Avatar"))
		require.NoError(t, writer.Close())

		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String(), &buf)
		req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		var u userResponse
		err := json.Unmarshal(rec.Body.Bytes(), &u)
		require.NoError(t, err)
		require.NotNil(t, u.FullName)
		assert.Equal(t, "No Avatar", *u.FullName)
	})
}
