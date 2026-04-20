package routes_test

import (
	"backend/db/project"
	"backend/models"
	"backend/routes"
	projectService "backend/services/project"
	userStore "backend/db/user"
	userService "backend/services/user"
	authService "backend/services/auth"
	"backend/testutils"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"fmt"
	"os"
	"bytes"


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

	return &http.Cookie {
		Name:	"sessionToken",
		Value:	string(jwt),
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
    aServ := authService.NewAuthenticationService(uServe)

	ctx := context.Background()
    email := "global@test.com"
    pass := "Password123!"
    
    _, err := uServe.CreateUser(ctx, "testuser", email, pass)
    require.NoError(t, err)

    globalCookie := getCookie(t, aServ, email, pass)

	handler := routes.NewProjectRouteHandler(service, aServ)
	
	desc := "Handler Integration Test"
	testProj, err := service.CreateProject(context.Background(), nil, "Handler Project", "handler-slug", &desc, "active")
	require.NoError(t, err)

	e := echo.New()
	api := e.Group("/api")

	handler.AddRoutes(api)

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
        newUser1, err := uServe.CreateUser(ctx, "member1", "member1@test.com", "Password123!")
        require.NoError(t, err)
        
        newUser2, err := uServe.CreateUser(ctx, "member2", "member2@test.com", "Password123!")
        require.NoError(t, err)

        payload := []projectService.AddMemberRequest{
            {UserId: newUser1.ID, Role: "boss"},
            {UserId: newUser2.ID, Role: "gopher"},
        }
        
        body, err := json.Marshal(payload)
        require.NoError(t, err)

        req := httptest.NewRequest(http.MethodPost, "/api/projects/"+testProj.ID.String()+"/members", bytes.NewBuffer(body))
        req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
        req.AddCookie(globalCookie)
        
        rec := httptest.NewRecorder()
        e.ServeHTTP(rec, req)

        assert.Equal(t, http.StatusCreated, rec.Code)

        var respMembers []models.ProjectMember
        err = json.Unmarshal(rec.Body.Bytes(), &respMembers)
        require.NoError(t, err)
        
        assert.Len(t, respMembers, 2)
        assert.Equal(t, testProj.ID, respMembers[0].ProjectID)
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