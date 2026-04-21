package project_test

import (
	"backend/db/project"
	projectService "backend/services/project"
	"backend/testutils"
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var db *gorm.DB

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, true, true)
}

func TestProjectService_Integration(t *testing.T) {
	//TODO: WRITE MORE TESTS
	store := project.NewProjectStore(db)
	service := projectService.NewProjectService(store)
	ctx := context.Background()

	t.Run("Successfully create and get project", func(t *testing.T) {
		desc := "Service Tests"
		
		p, err := service.CreateProject(ctx, nil, "Service Project", "service-slug", &desc, "active")
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, p.ID)

		fetchedProj, err := service.GetProject(ctx, p.ID)
		
		assert.NoError(t, err)
		assert.Equal(t, p.Name, fetchedProj.Name)
		assert.Equal(t, "service-slug", fetchedProj.Slug)
	})

	t.Run("Project not found returns service error wrapper", func(t *testing.T) {
		proj, err := service.GetProject(ctx, uuid.New())

		assert.ErrorIs(t, err, projectService.ErrProjectNotFound)
		assert.Nil(t, proj)
	})

	t.Run("Duplicate slug returns service error wrapper", func(t *testing.T) {
		desc := "Duplicate test"
		_, err := service.CreateProject(ctx, nil, "First", "shared-slug", &desc, "active")
		require.NoError(t, err)

		_, err = service.CreateProject(ctx, nil, "Second", "shared-slug", &desc, "active")
		assert.ErrorIs(t, err, projectService.ErrDuplicateSlug)
	})
}
