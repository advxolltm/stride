package routes_test

import (
	"backend/db/project"
	userStore "backend/db/user"
	"backend/models"
	"backend/routes"
	authService "backend/services/auth"
	projectService "backend/services/project"
	userService "backend/services/user"
	"backend/testutils"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var db *gorm.DB

func TestMain(m *testing.M) {
	db = testutils.SetupDB()
	db.Begin()
	testutils.SeedDB(db)
	exitCode := m.Run()
	db.Rollback()
	defer testutils.TeardownDB()
	os.Exit(exitCode)
}

func getCookie(t *testing.T, authServ authService.AuthService, email string, password string) *http.Cookie {
	jwt, _, err := authServ.AuthenticateUser(context.Background(), email, password)
	require.NoError(t, err)
	return &http.Cookie{Name: "sessionToken", Value: string(jwt)}
}

func runTest(t *testing.T, name string, f func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User)) {
	t.Run(name, func(t *testing.T) {
		t.Setenv("SESSION_SECRET", "super-secret")
		db.Transaction(func(tx *gorm.DB) error {
			// Setup Stack
			pStore := project.NewProjectStore(tx)
			pServ := projectService.NewProjectService(pStore)
			uStore := userStore.NewUserStore(tx)
			uServ := userService.NewUserService(uStore)
			aServ := authService.NewAuthenticationService(uServ, pServ)
			handler := routes.NewProjectRouteHandler(pServ, aServ)

			e := echo.New()
			handler.AddRoutes(e.Group("/api"))

			loginUser, err := uServ.CreateUser(context.Background(), "cookieMonster", "cookie@monster.com", "nomnom*!")
			require.NoError(t, err)
			cookie := getCookie(t, aServ, loginUser.Email, "nomnom*!")

			f(t, tx, aServ, pServ, uServ, e, cookie, *loginUser)
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}

func TestProjectRouteHandler_Integration(t *testing.T) {
	ctx := context.Background()

	runTest(t, "Returns 201 and correctly populates all fields on project creation", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		projectName := "createProj"
		projectSlug := "bloop-bleep"
		projectDesc := "A project bloop bleep"
		projectStatus := "active"

		payload := routes.CreateProjectRequest{
			Name:        projectName,
			Slug:        projectSlug,
			Description: &projectDesc,
			Status:      projectStatus,
		}

		body, err := json.Marshal(payload)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusCreated, rec.Code)

		var created routes.ReturnProj
		err = json.Unmarshal(rec.Body.Bytes(), &created)
		require.NoError(t, err)

		assert.NotEqual(t, uuid.Nil, created.ID)
		assert.Equal(t, projectName, created.Name)
		assert.Equal(t, projectSlug, created.Slug)
		assert.Equal(t, projectDesc, *created.Description)
		assert.Equal(t, projectStatus, created.Status)

		assert.NotNil(t, created.CreatedBy)
		assert.Equal(t, loginUser.ID, *created.CreatedBy)
		assert.Len(t, created.Members, 1)
		assert.Len(t, created.Skills, 0)
	})

	runTest(t, "Returns 200 and projects for current user", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		desc1 := "Project One"
		_, err1 := ps.CreateProject(ctx, &loginUser.ID, "Alpha", "alpha", &desc1, "active")
		require.NoError(t, err1)

		desc2 := "Project Two"
		_, err2 := ps.CreateProject(ctx, &loginUser.ID, "Beta", "beta", &desc2, "active")
		require.NoError(t, err2)

		req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var respProjects []routes.ReturnProj
		err3 := json.Unmarshal(rec.Body.Bytes(), &respProjects)
		require.NoError(t, err3)

		assert.GreaterOrEqual(t, len(respProjects), 2)

		found := false
		for _, p := range respProjects {
			if p.Name == "Alpha" {
				found = true
				break
			}
		}
		assert.True(t, found)
	})

	runTest(t, "Returns 200 on successful retrieval", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		testProj := testutils.GenerateRandomProject([]models.User{loginUser})
		txErr := tx.Create(&testProj).Error
		require.NoError(t, txErr)
		req := httptest.NewRequest(http.MethodGet, "/api/projects/"+testProj.ID.String(), nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var respProject routes.ReturnProj
		err := json.Unmarshal(rec.Body.Bytes(), &respProject)
		require.NoError(t, err)

		assert.Equal(t, testProj.ID, respProject.ID)
		assert.Equal(t, loginUser.ID, *respProject.CreatedBy)
		assert.Equal(t, testProj.Name, respProject.Name)
	})

	runTest(t, "Returns 400 on invalid UUID", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/invalid-uuid-string", nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "Returns 404 on project not found", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/"+uuid.New().String(), nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	runTest(t, "Returns 201 on successfully adding members", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		newUser2, err := us.CreateUser(ctx, "member2", "member2@test.com", "Password123!")
		require.NoError(t, err)

		desc := "adding some members"
		memberProj, err := ps.CreateProject(ctx, &loginUser.ID, "AddMembers Project", "add-members", &desc, "active")
		require.NoError(t, err)

		payload := []projectService.AddMemberRequest{
			{UserId: newUser2.ID, Role: "gopher"},
		}

		body, err := json.Marshal(payload)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/projects/"+memberProj.ID.String()+"/members", bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusCreated, rec.Code)

		var respMembers []routes.ReturnMember
		err = json.Unmarshal(rec.Body.Bytes(), &respMembers)
		require.NoError(t, err)

		assert.Len(t, respMembers, 1)
		assert.Equal(t, memberProj.ID, respMembers[0].ProjectID)

		members, err := ps.GetProjectMembers(ctx, memberProj.ID)
		require.NoError(t, err)
		assert.Len(t, members, 2)
	})

	runTest(t, "Returns 400 on invalid project UUID for members POST", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		req := httptest.NewRequest(http.MethodPost, "/api/projects/invalid-uuid/members", nil)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "Returns 400 on invalid JSON body", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		badBody := []byte(`{"user_id": "123", "role": "admin"}`)
		testProj := testutils.SelectRandomProject(t, db)

		req := httptest.NewRequest(http.MethodPost, "/api/projects/"+testProj.ID.String()+"/members", bytes.NewBuffer(badBody))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "Returns handled error when target project does not exist", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		newUser3, err := us.CreateUser(ctx, "member3", "member3@test.com", "Password123!")
		require.NoError(t, err)

		payload := []projectService.AddMemberRequest{
			{UserId: newUser3.ID, Role: "chillin"},
		}
		body, err := json.Marshal(payload)
		require.NoError(t, err)

		fakeProjID := uuid.New().String()
		req := httptest.NewRequest(http.MethodPost, "/api/projects/"+fakeProjID+"/members", bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	runTest(t, "Returns 200 and updated fields on project update", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		desc := "Original"
		proj, _ := ps.CreateProject(ctx, &loginUser.ID, "Old Name", "old-slug", &desc, "active")

		newName := "New Name"
		newSlug := "new-slug"
		payload := projectService.UpdateProjectInput{
			Name: &newName,
			Slug: &newSlug,
		}

		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPatch, "/api/projects/"+proj.ID.String(), bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var updated routes.ReturnProj
		json.Unmarshal(rec.Body.Bytes(), &updated)
		assert.Equal(t, newName, updated.Name)
		assert.Equal(t, newSlug, updated.Slug)
	})

	runTest(t, "Returns 409 Conflict on duplicate slug during update", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		ps.CreateProject(ctx, &loginUser.ID, "Existing", "taken-slug", nil, "active")
		proj, _ := ps.CreateProject(ctx, &loginUser.ID, "Target", "target-slug", nil, "active")

		newSlug := "taken-slug"
		payload := projectService.UpdateProjectInput{Slug: &newSlug}
		body, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPatch, "/api/projects/"+proj.ID.String(), bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusConflict, rec.Code)
	})

	runTest(t, "Returns 204 on successful project deletion", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, _ := ps.CreateProject(ctx, &loginUser.ID, "To Delete", "delete-me", nil, "active")

		req := httptest.NewRequest(http.MethodDelete, "/api/projects/"+proj.ID.String(), nil)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		_, err := ps.GetProject(ctx, proj.ID)
		assert.ErrorIs(t, err, projectService.ErrProjectNotFound)
	})

	runTest(t, "Returns 201 on successfully adding a project skill", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, _ := ps.CreateProject(ctx, &loginUser.ID, "Skill Project", "skill-slug", nil, "active")

		payload := map[string]string{
			"name":        "Go",
			"description": "Backend language",
		}
		body, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPost, "/api/projects/"+proj.ID.String()+"/skills", bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusCreated, rec.Code)

		skills, _ := ps.GetProjectSkills(ctx, proj.ID)
		assert.Len(t, skills, 1)
		assert.Equal(t, "Go", skills[0].Name)
	})

	runTest(t, "Returns 204 on successfully removing a project skill", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, _ := ps.CreateProject(ctx, &loginUser.ID, "Skill Project", "skill-slug", nil, "active")
		desc := "desc"
		skill, _ := ps.AddProjectSkill(ctx, proj.ID, "React", &desc)

		req := httptest.NewRequest(http.MethodDelete, "/api/projects/skills/"+skill.ID.String(), nil)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		skills, _ := ps.GetProjectSkills(ctx, proj.ID)
		assert.Len(t, skills, 0)
	})

	runTest(t, "Returns 204 on successful member removal", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, _ := ps.CreateProject(ctx, &loginUser.ID, "Team Project", "team-slug", nil, "active")
		otherUser, _ := us.CreateUser(ctx, "other", "other@test.com", "Password123!")
		ps.AddUsersToProject(ctx, []projectService.AddMemberRequest{{UserId: otherUser.ID, Role: "developer"}}, proj.ID)

		req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/projects/%s/members/%s", proj.ID, otherUser.ID), nil)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		members, _ := ps.GetProjectMembers(ctx, proj.ID)
		// Only owner should remain
		for _, m := range members {
			assert.NotEqual(t, otherUser.ID, m.UserID)
		}
	})

	runTest(t, "Returns 404 when removing non-existent member", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, _ := ps.CreateProject(ctx, &loginUser.ID, "Team Project", "team-slug", nil, "active")
		randomID := uuid.New().String()

		req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/projects/%s/members/%s", proj.ID, randomID), nil)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	runTest(t, "Delete Skill: Returns 204 when user is the project owner", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, _ := ps.CreateProject(ctx, &loginUser.ID, "Owner Proj", "owner-slug", nil, "active")

		desc := "test"
		skill, err := ps.AddProjectSkill(ctx, proj.ID, "Go", &desc)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodDelete, "/api/projects/skills/"+skill.ID.String(), nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)
	})

	runTest(t, "Delete Skill: Returns 401 when user is NOT the project owner", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		otherUser, _ := us.CreateUser(ctx, "otherGuy", "other@guy.com", "Password123!")
		proj, _ := ps.CreateProject(ctx, &otherUser.ID, "Other Proj", "other-slug", nil, "active")

		desc := "test"
		skill, _ := ps.AddProjectSkill(ctx, proj.ID, "Java", &desc)

		req := httptest.NewRequest(http.MethodDelete, "/api/projects/skills/"+skill.ID.String(), nil)
		req.AddCookie(cookie) // This cookie belongs to loginUser, not otherUser
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)

		skills, _ := ps.GetProjectSkills(ctx, proj.ID)
		assert.Len(t, skills, 1)
	})

	runTest(t, "Delete Skill: Returns 404 when skill does not exist", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		req := httptest.NewRequest(http.MethodDelete, "/api/projects/skills/"+uuid.New().String(), nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}
