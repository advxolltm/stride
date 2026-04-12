package routes_test

import (
	"backend/db/project"
	"backend/models"
	"backend/routes"
	projectService "backend/services/project"
	"backend/testutils"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testutils.SetupDB()
	defer testutils.TeardownDB()
	m.Run()
}

func TestProjectRouteHandler_Integration(t *testing.T) {
	//TODO: WRITE MORE TESTS
	store := project.NewProjectStore(testutils.DB)
	service := projectService.NewProjectService(store)
	
	desc := "Handler Integration Test"
	testProj, err := service.CreateProject(context.Background(), nil, "Handler Project", "handler-slug", &desc, "active")
	require.NoError(t, err)

	e := echo.New()
	api := e.Group("/api")
	
	handler := routes.NewProjectRouteHandler(service)
	handler.AddRoutes(api)

	t.Run("Returns 200 on successful retrieval", func(t *testing.T) {
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

	t.Run("Returns 400 on invalid UUID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/invalid-uuid-string", nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("Returns 404 on project not found", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/"+uuid.New().String(), nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}