package project_test

import (
	"backend/db/project"
	"backend/models"
	"backend/testutils"
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMain(m *testing.M) {
	testutils.SetupDB()
	defer testutils.TeardownDB()

	m.Run()
}

func TestProjectStore_CreateAndGetProject(t *testing.T) {
	//TODO: WRITE MORE TESTS
	store := project.NewProjectStore(testutils.DB)
	ctx := context.Background()

	t.Run("Create a new project successfully", func(t *testing.T) {
		desc := "Test Description"
		p := &models.Project{
			Name:        "Test Project",
			Slug:        "test-project-slug",
			Description: &desc,
			Status:      "active",
		}

		err := store.CreateProject(ctx, p)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, p.ID)

		fetchedProj, err := store.GetProject(ctx, p.ID)
		require.NoError(t, err)
		assert.Equal(t, p.Name, fetchedProj.Name)
		assert.Equal(t, p.Slug, fetchedProj.Slug)
	})

	t.Run("Create project with duplicate slug fails", func(t *testing.T) {
		p1 := &models.Project{Name: "Proj 1", Slug: "duplicate-slug", Status: "active"}
		err := store.CreateProject(ctx, p1)
		require.NoError(t, err)

		p2 := &models.Project{Name: "Proj 2", Slug: "duplicate-slug", Status: "active"}
		err = store.CreateProject(ctx, p2)
		
		assert.ErrorIs(t, err, project.ErrDuplicateSlug)
	})

	t.Run("Get non-existent project returns error", func(t *testing.T) {
		_, err := store.GetProject(ctx, uuid.New())
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}