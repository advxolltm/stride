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
	//testutils.SeedDB()
	exitCode := m.Run()
	db.Rollback()
	defer testutils.TeardownDB()
	os.Exit(exitCode)
}

func getCookie(t *testing.T, authServ authService.AuthService, email string, password string) *http.Cookie {
	jwt, _, err := authServ.AuthenticateUser(context.Background(), email, password)

	require.NoError(t, err)

	return &http.Cookie{
		Name:  "sessionToken",
		Value: string(jwt),
	}
}

func TestProjectRouteHandler_Integration(t *testing.T) {

	runTest := func(t *testing.T, name string, f func(*testing.T, *gorm.DB)) {
		t.Run(name, func(t *testing.T) {
			db.Transaction(func(tx *gorm.DB) error {
				f(t, tx)
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	//TODO: WRITE MORE TESTS

	os.Setenv("SESSION_SECRET", "secretsecret")
	store := project.NewProjectStore(db)
	service := projectService.NewProjectService(store)

	uStore := userStore.NewUserStore(db)
	uServe := userService.NewUserService(uStore)
	aServ := authService.NewAuthenticationService(uServe, service)

	ctx := context.Background()
	email := "global@test.com"
	pass := "Password123!"

	testuser, err := uServe.CreateUser(ctx, "testuser", email, pass)
	require.NoError(t, err)

	globalCookie := getCookie(t, aServ, email, pass)

	handler := routes.NewProjectRouteHandler(service, aServ)

	desc := "Handler Integration Test"
	testProj, err := service.CreateProject(context.Background(), &testuser.ID, "Handler Project", "handler-slug", &desc, "active")
	require.NoError(t, err)

	e := echo.New()
	api := e.Group("/api")

	handler.AddRoutes(api)

	runTest(t, "Returns 201 and correctly populates all fields on project creation", func(t *testing.T, tx *gorm.DB) {
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
		req.AddCookie(globalCookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusCreated, rec.Code)

		var created models.Project
		err = json.Unmarshal(rec.Body.Bytes(), &created)
		require.NoError(t, err)

		assert.NotEqual(t, uuid.Nil, created.ID)
		assert.Equal(t, projectName, created.Name)
		assert.Equal(t, projectSlug, created.Slug)
		assert.Equal(t, projectDesc, *created.Description)
		assert.Equal(t, projectStatus, created.Status)

		assert.NotNil(t, created.CreatedBy)
		assert.Equal(t, testuser.ID, *created.CreatedBy)
	})

	runTest(t, "Returns 200 and projects for current user", func(t *testing.T, tx *gorm.DB) {
		newUser, err := uServe.CreateUser(ctx, "projectowner", "owner@test.com", "Password123!")
		require.NoError(t, err)

		ownerCookie := getCookie(t, aServ, "owner@test.com", "Password123!")

		desc1 := "Project One"
		_, err = service.CreateProject(ctx, &newUser.ID, "Alpha", "alpha", &desc1, "active")
		require.NoError(t, err)

		desc2 := "Project Two"
		_, err = service.CreateProject(ctx, &newUser.ID, "Beta", "beta", &desc2, "active")
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
		req.AddCookie(ownerCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var respProjects []models.Project
		err = json.Unmarshal(rec.Body.Bytes(), &respProjects)
		require.NoError(t, err)

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

	runTest(t, "Returns 200 on successful retrieval", func(t *testing.T, db *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/"+testProj.ID.String(), nil)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var respProject models.Project
		err := json.Unmarshal(rec.Body.Bytes(), &respProject)
		require.NoError(t, err)

		assert.Equal(t, testProj.ID, respProject.ID)
		assert.Equal(t, testuser.ID, *respProject.CreatedBy)
		assert.Equal(t, "Handler Project", respProject.Name)
	})

	runTest(t, "Returns 400 on invalid UUID", func(t *testing.T, db *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/invalid-uuid-string", nil)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "Returns 404 on project not found", func(t *testing.T, db *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/"+uuid.New().String(), nil)
		req.AddCookie(globalCookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	runTest(t, "Returns 201 on successfully adding members", func(t *testing.T, tx *gorm.DB) {
		txStore := project.NewProjectStore(tx)
		txService := projectService.NewProjectService(txStore)
		txUStore := userStore.NewUserStore(tx)
		txUServe := userService.NewUserService(txUStore)
		txAServ := authService.NewAuthenticationService(txUServe, txService)

		// 2. IMPORTANT: Re-initialize the handler with the TX services
		txHandler := routes.NewProjectRouteHandler(txService, txAServ)

		// 3. Setup a local Echo instance just for this TX session
		localE := echo.New()
		txHandler.AddRoutes(localE.Group("/api"))

		newUser1, err := txUServe.CreateUser(ctx, "member1", "member1@test.com", "Password123!")
		require.NoError(t, err)
		ownerCookie := getCookie(t, txAServ, "member1@test.com", "Password123!")

		newUser2, err := txUServe.CreateUser(ctx, "member2", "member2@test.com", "Password123!")
		require.NoError(t, err)

		desc := "adding some members"
		memberProj, err := txService.CreateProject(context.Background(), &newUser1.ID, "AddMembers Project", "add-members", &desc, "active")
		require.NoError(t, err)

		payload := []projectService.AddMemberRequest{
			{UserId: newUser2.ID, Role: "gopher"},
		}

		body, err := json.Marshal(payload)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/projects/"+memberProj.ID.String()+"/members", bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(ownerCookie)

		rec := httptest.NewRecorder()
		localE.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusCreated, rec.Code)

		var respMembers []routes.ReturnMember
		err = json.Unmarshal(rec.Body.Bytes(), &respMembers)
		require.NoError(t, err)

		assert.Len(t, respMembers, 1)
		assert.Equal(t, memberProj.ID, respMembers[0].ProjectID)

		members, err := txService.GetProjectMembers(ctx, memberProj.ID)
		require.NoError(t, err)
		assert.Len(t, members, 2)
	})

	runTest(t, "Returns 400 on invalid project UUID for members POST", func(t *testing.T, tx *gorm.DB) {
		req := httptest.NewRequest(http.MethodPost, "/api/projects/invalid-uuid/members", nil)
		req.AddCookie(globalCookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "Returns 400 on invalid JSON body", func(t *testing.T, tx *gorm.DB) {
		badBody := []byte(`{"user_id": "123", "role": "admin"}`)

		req := httptest.NewRequest(http.MethodPost, "/api/projects/"+testProj.ID.String()+"/members", bytes.NewBuffer(badBody))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(globalCookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "Returns handled error when target project does not exist", func(t *testing.T, tx *gorm.DB) {
		newUser3, err := uServe.CreateUser(ctx, "member3", "member3@test.com", "Password123!")
		require.NoError(t, err)

		payload := []projectService.AddMemberRequest{
			{UserId: newUser3.ID, Role: "chillin"},
		}
		body, err := json.Marshal(payload)
		require.NoError(t, err)

		fakeProjID := uuid.New().String()
		req := httptest.NewRequest(http.MethodPost, "/api/projects/"+fakeProjID+"/members", bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(globalCookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}
