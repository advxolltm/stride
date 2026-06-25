package routes_user_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	userStore "backend/db/user"
	"backend/models"
	"backend/routes"
	authService "backend/services/auth"
	userService "backend/services/user"
	"backend/testutils"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

func getCookie(t *testing.T, authServ authService.AuthService, email string, password string) *http.Cookie {
	t.Helper()
	jwt, _, err := authServ.AuthenticateUser(context.Background(), email, password)
	require.NoError(t, err)
	return &http.Cookie{
		Name:  "sessionToken",
		Value: string(jwt),
	}
}

// userResponse mirrors routes.User for test deserialization
type userResponse struct {
	ID        string             `json:"id"`
	Username  string             `json:"username"`
	Email     string             `json:"email"`
	FullName  *string            `json:"full_name"`
	AvatarURL *avatarURLResponse `json:"avatar_url"`
}

type avatarURLResponse struct {
	Small    string `json:"300"`
	Medium   string `json:"600"`
	Original string `json:"original"`
}

// type userSkillResponse struct {
// 	ID             string               `json:"id"`
// 	UserID         string               `json:"user_id"`
// 	ProjectSkillID string               `json:"project_skill_id"`
// 	ProjectSkill   projectSkillResponse `json:"project_skill"`
// }

// type projectSkillResponse struct {
// 	ID          string  `json:"id"`
// 	ProjectID   string  `json:"project_id"`
// 	Name        string  `json:"name"`
// 	Description *string `json:"description"`
// }

type userTestEnv struct {
	ctx          context.Context
	e            *echo.Echo
	testUser     *models.User
	testPassword string
	globalCookie *http.Cookie
	uServe       userService.UserService
	aServ        authService.AuthService
}

func newUserTestEnv(t *testing.T, tx *gorm.DB) userTestEnv {
	t.Helper()

	uStore := userStore.NewUserStore(tx)
	uServe := userService.NewUserService(uStore)
	aServ := authService.NewAuthenticationService(uServe)

	ctx := context.Background()
	email := fmt.Sprintf("userhandler-%s@test.com", uuid.NewString())
	username := fmt.Sprintf("userhandlertest-%s", uuid.NewString()[:8])
	pass := "Password123!"

	testUser, err := uServe.CreateUser(ctx, username, email, pass)
	require.NoError(t, err)

	handler := routes.NewUserRouteHandler(uServe, aServ, nil)
	e := echo.New()
	api := e.Group("/api")
	handler.AddRoutes(api)

	return userTestEnv{
		ctx:          ctx,
		e:            e,
		testUser:     testUser,
		testPassword: pass,
		globalCookie: getCookie(t, aServ, email, pass),
		uServe:       uServe,
		aServ:        aServ,
	}
}

func TestUserRouteHandler_Integration(t *testing.T) {
	err := os.Setenv("SESSION_SECRET", "secretsecret")
	require.NoError(t, err)

	runTest := func(t *testing.T, name string, f func(*testing.T, *gorm.DB)) {
		t.Run(name, func(t *testing.T) {
			_ = db.Transaction(func(tx *gorm.DB) error {
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

	runTest(t, "POST /users returns 201 without auth", func(t *testing.T, tx *gorm.DB) {
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

		require.Equal(t, http.StatusCreated, rec.Code)

		var u userResponse
		err := json.Unmarshal(rec.Body.Bytes(), &u)
		require.NoError(t, err)
		assert.Equal(t, "noauth", u.Username)
		assert.Equal(t, "noauth@test.com", u.Email)
	})

	runTest(t, "POST /users returns 401 without auth in open network mode", func(t *testing.T, tx *gorm.DB) {
		t.Setenv("APPLICATION_MODE", "open_network")
		env := newUserTestEnv(t, tx)
		body := map[string]string{
			"username": "open-noauth",
			"email":    "open-noauth@test.com",
			"password": "Str0ng!Pass",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	runTest(t, "POST /users returns 403 for non-superuser in open network mode", func(t *testing.T, tx *gorm.DB) {
		t.Setenv("APPLICATION_MODE", "open_network")
		env := newUserTestEnv(t, tx)
		body := map[string]string{
			"username": "open-normal",
			"email":    "open-normal@test.com",
			"password": "Str0ng!Pass",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	runTest(t, "POST /users returns 201 for superuser in open network mode", func(t *testing.T, tx *gorm.DB) {
		t.Setenv("APPLICATION_MODE", "open_network")
		env := newUserTestEnv(t, tx)
		superuser, err := env.uServe.CreateUserWithOptions(
			env.ctx,
			"superuser-"+uuid.NewString()[:8],
			"superuser-"+uuid.NewString()[:8]+"@test.com",
			"AdminValid!123",
			userService.CreateUserOptions{IsSuperuser: true},
		)
		require.NoError(t, err)

		body := map[string]string{
			"username": "open-created",
			"email":    "open-created@test.com",
			"password": "Str0ng!Pass",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(getCookie(t, env.aServ, superuser.Email, "AdminValid!123"))
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusCreated, rec.Code)
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

	// PATCH /users/:id password guard

	runTest(t, "PATCH /users/:id ignores password changes", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		newPassword := "NewValid!123"
		body := map[string]string{"password": newPassword}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String(), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		_, _, err := env.aServ.AuthenticateUser(env.ctx, env.testUser.Email, newPassword)
		assert.Error(t, err)

		_, _, err = env.aServ.AuthenticateUser(env.ctx, env.testUser.Email, env.testPassword)
		require.NoError(t, err)
	})

	// PATCH /users/:id/password

	runTest(t, "PATCH /users/:id/password returns 204 and changes password when current password is correct", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		newPassword := "NewValid!123"
		body := map[string]string{
			"current_password": env.testPassword,
			"new_password":     newPassword,
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String()+"/password", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusNoContent, rec.Code)

		_, _, err = env.aServ.AuthenticateUser(env.ctx, env.testUser.Email, env.testPassword)
		assert.Error(t, err)

		_, _, err = env.aServ.AuthenticateUser(env.ctx, env.testUser.Email, newPassword)
		require.NoError(t, err)
	})

	runTest(t, "PATCH /users/:id/password returns 401 when current password is wrong", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		body := map[string]string{
			"current_password": "Wrong!123",
			"new_password":     "NewValid!123",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String()+"/password", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)

		_, _, err := env.aServ.AuthenticateUser(env.ctx, env.testUser.Email, env.testPassword)
		require.NoError(t, err)
	})

	runTest(t, "PATCH /users/:id/password returns 400 when new password is weak", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		body := map[string]string{
			"current_password": env.testPassword,
			"new_password":     "weak",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String()+"/password", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "PATCH /users/:id/password returns 400 when new password matches current password", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		body := map[string]string{
			"current_password": env.testPassword,
			"new_password":     env.testPassword,
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String()+"/password", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "PATCH /users/:id/password returns 401 when changing another user's password", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		otherUser, err := env.uServe.CreateUser(env.ctx, "otherPasswordUser", "other-password@test.com", "OtherValid!123")
		require.NoError(t, err)
		body := map[string]string{
			"current_password": "OtherValid!123",
			"new_password":     "NewValid!123",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+otherUser.ID.String()+"/password", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	runTest(t, "PATCH /users/:id/password returns 400 on invalid UUID", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/bad-uuid/password", bytes.NewReader([]byte("{}")))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "PATCH /users/:id/password returns 401 without auth", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		body := map[string]string{
			"current_password": env.testPassword,
			"new_password":     "NewValid!123",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, "/api/users/"+env.testUser.ID.String()+"/password", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// // User skills

	// runTest(t, "GET /users/:id/skills returns selected skills for authenticated user", func(t *testing.T, tx *gorm.DB) {
	// 	env := newUserTestEnv(t, tx)
	// 	desc := "Search engine optimization"
	// 	project := models.Project{
	// 		CreatedBy: &env.testUser.ID,
	// 		Name:      "Marketing",
	// 		Slug:      "marketing-" + uuid.NewString(),
	// 		Status:    "active",
	// 	}
	// 	require.NoError(t, tx.Create(&project).Error)
	// 	require.NoError(t, tx.Create(&models.ProjectMember{
	// 		UserID:    env.testUser.ID,
	// 		ProjectID: project.ID,
	// 		Role:      "owner",
	// 	}).Error)
	// 	skill := models.ProjectSkill{
	// 		ProjectID:   project.ID,
	// 		Name:        "SEO",
	// 		Description: &desc,
	// 	}
	// 	require.NoError(t, tx.Create(&skill).Error)
	// 	require.NoError(t, tx.Model(&models.ProjectMember{}).Where("user_id = ? AND project_id = ?", env.testUser.ID, project.ID).
	// 		Association("Skills").Append(&skill))

	// 	req := httptest.NewRequest(http.MethodGet, "/api/users/"+env.testUser.ID.String()+"/skills", nil)
	// 	req.AddCookie(env.globalCookie)
	// 	rec := httptest.NewRecorder()
	// 	env.e.ServeHTTP(rec, req)

	// 	require.Equal(t, http.StatusOK, rec.Code)

	// 	var skills []userSkillResponse
	// 	err := json.Unmarshal(rec.Body.Bytes(), &skills)
	// 	require.NoError(t, err)
	// 	require.Len(t, skills, 1)
	// 	assert.Equal(t, env.testUser.ID.String(), skills[0].UserID)
	// 	assert.Equal(t, skill.ID.String(), skills[0].ProjectSkillID)
	// 	assert.Equal(t, project.ID.String(), skills[0].ProjectSkill.ProjectID)
	// 	assert.Equal(t, "SEO", skills[0].ProjectSkill.Name)
	// })

	runTest(t, "PUT /users/:id/projects/:projectId/skills replaces selected skills for one project", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		project := models.Project{
			CreatedBy: &env.testUser.ID,
			Name:      "Product Launch",
			Slug:      "product-launch-" + uuid.NewString(),
			Status:    "active",
		}
		require.NoError(t, tx.Create(&project).Error)
		require.NoError(t, tx.Create(&models.ProjectMember{
			UserID:    env.testUser.ID,
			ProjectID: project.ID,
			Role:      "owner",
		}).Error)
		oldSkill := models.ProjectSkill{ProjectID: project.ID, Name: "Old Skill"}
		firstSkill := models.ProjectSkill{ProjectID: project.ID, Name: "SEO"}
		secondSkill := models.ProjectSkill{ProjectID: project.ID, Name: "Analytics"}
		require.NoError(t, tx.Create(&oldSkill).Error)
		require.NoError(t, tx.Create(&firstSkill).Error)
		require.NoError(t, tx.Create(&secondSkill).Error)

		var member models.ProjectMember
		err := tx.Where("user_id = ? AND project_id = ?", env.testUser.ID, project.ID).First(&member).Error
		require.NoError(t, err)
		err = tx.Model(&member).Association("Skills").Append(&oldSkill)
		require.NoError(t, err)

		body := map[string][]uuid.UUID{
			"project_skill_ids": {firstSkill.ID, secondSkill.ID},
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPut, "/api/users/"+env.testUser.ID.String()+"/projects/"+project.ID.String()+"/skills", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		var skills []models.ProjectSkill
		err_um := json.Unmarshal(rec.Body.Bytes(), &skills)
		require.NoError(t, err_um)
		selectedSkillIDs := map[string]bool{}
		for _, skill := range skills {
			selectedSkillIDs[skill.ID.String()] = true
		}
		assert.False(t, selectedSkillIDs[oldSkill.ID.String()])
		assert.True(t, selectedSkillIDs[firstSkill.ID.String()])
		assert.True(t, selectedSkillIDs[secondSkill.ID.String()])
	})

	runTest(t, "PUT /users/:id/projects/:projectId/skills returns 401 when user is not a project member", func(t *testing.T, tx *gorm.DB) {
		env := newUserTestEnv(t, tx)
		project := models.Project{
			Name:   "Private Project",
			Slug:   "private-" + uuid.NewString(),
			Status: "active",
		}
		require.NoError(t, tx.Create(&project).Error)

		body := map[string][]uuid.UUID{"project_skill_ids": {}}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPut, "/api/users/"+env.testUser.ID.String()+"/projects/"+project.ID.String()+"/skills", bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(env.globalCookie)
		rec := httptest.NewRecorder()
		env.e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	// DELETE /users/:id

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
		require.NoError(t, png.Encode(part, image.NewNRGBA(image.Rect(0, 0, 1, 1))))
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
		assert.Contains(t, u.AvatarURL.Small, "?v=")
		assert.Contains(t, u.AvatarURL.Medium, "/600.png")
		assert.Contains(t, u.AvatarURL.Medium, "?v=")
		assert.Contains(t, u.AvatarURL.Original, "/original.png")
		assert.Contains(t, u.AvatarURL.Original, "?v=")
		assert.Equal(t, "Avatar User", *u.FullName)
	})

	runTest(t, "PATCH /users/:id returns 200 and deletes avatar files when remove_avatar is true", func(t *testing.T, tx *gorm.DB) {
		mediaDir := t.TempDir()
		t.Setenv("MEDIA_DIR", mediaDir)
		env := newUserTestEnv(t, tx)

		var avatar bytes.Buffer
		require.NoError(t, png.Encode(&avatar, image.NewNRGBA(image.Rect(0, 0, 1, 1))))

		updated, err := env.uServe.UpdateUser(env.ctx, env.testUser.ID, userService.UpdateUserInput{
			Avatar: &userService.AvatarInput{
				Filename: "photo.png",
				File:     bytes.NewReader(avatar.Bytes()),
				Size:     int64(avatar.Len()),
			},
		})
		require.NoError(t, err)
		require.NotNil(t, updated.AvatarURL)

		avatarDir := filepath.Join(mediaDir, "avatars", env.testUser.ID.String())
		_, err = os.Stat(avatarDir)
		require.NoError(t, err)

		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		require.NoError(t, writer.WriteField("remove_avatar", "true"))
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
		assert.Nil(t, u.AvatarURL)

		_, err = os.Stat(avatarDir)
		assert.True(t, os.IsNotExist(err))
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
