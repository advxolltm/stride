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


	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var db *gorm.DB

func TestMain(m *testing.M) {
	testutils.SetupDB()
	testutils.DB.Begin()
	//testutils.SeedDB()
	exitCode := m.Run()
	testutils.DB.Rollback()
	defer testutils.TeardownDB()
	os.Exit(exitCode)
}

func TestProjectRouteHandler_Integration(t *testing.T) {

	runTest := func(t *testing.T, name string, f func(*testing.T, *gorm.DB)) {
		t.Run(name, func(t *testing.T) {
			testutils.DB.Transaction(func(tx *gorm.DB) error {
				f(t, tx)
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	//TODO: WRITE MORE TESTS
	store := project.NewProjectStore(testutils.DB)
	service := projectService.NewProjectService(store)

	os.Setenv("SESSION_SECRET", "secretsecret")
	auth := authService.NewAuthenticationService(userService.NewUserService(userStore.NewUserStore(testutils.DB)))
	handler := routes.NewProjectRouteHandler(service, auth)
	
	desc := "Handler Integration Test"
	testProj, err := service.CreateProject(context.Background(), nil, "Handler Project", "handler-slug", &desc, "active")
	require.NoError(t, err)

	e := echo.New()
	api := e.Group("/api")

	handler.AddRoutes(api)

	runTest(t, "Returns 200 on successful retrieval", func(t *testing.T, db *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/"+testProj.ID.String(), nil)
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
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runTest(t, "Returns 404 on project not found", func(t *testing.T, db *gorm.DB) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/"+uuid.New().String(), nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}