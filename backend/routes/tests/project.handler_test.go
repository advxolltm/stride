package routes_test

import (
	"backend/db/project"
	userStore "backend/db/user"
	whiteboardDB "backend/db/whiteboard"
	"backend/models"
	"backend/routes/projects"
	authService "backend/services/auth"
	projectService "backend/services/project"
	userService "backend/services/user"
	whiteboardService "backend/services/whiteboard"
	"backend/testutils"
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
	testutils.RunTestMain(m, &db, false, true)
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

	wbStore := whiteboardDB.NewWhiteboardStore(db)
	wbService := whiteboardService.NewWhiteboardService(wbStore, service)

	handler := projects.NewProjectsGroup(service, wbService, aServ)
	
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
}
