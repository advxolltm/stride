package project_test

import (
	"backend/db/project"
	"backend/models"
	"backend/testutils"
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var db *gorm.DB

func newTestProjectStore(db *gorm.DB) project.ProjectStore {
	return project.NewProjectStore(db)
}

func TestMain(m *testing.M) {
	db = testutils.SetupDB()
	db = db.Begin()
	testutils.SeedDB(db)
	exitCode := m.Run()
	db.Rollback()
	testutils.TeardownDB()
	os.Exit(exitCode)
}

func runTest(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, project.ProjectStore)) {
	t.Run(name, func(t *testing.T) {
		db.Transaction(func(tx *gorm.DB) error {
			f(t, tx, newTestProjectStore(tx))
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}

func TestProjectStore_CreateAndGetProject(t *testing.T) {
	//TODO: WRITE MORE TESTS
	ctx := context.Background()

	runTest(t, db, "Create a new project successfully", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
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

	runTest(t, db, "Create project with duplicate slug fails", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		p1 := &models.Project{Name: "Proj 1", Slug: "duplicate-slug", Status: "active"}
		err := store.CreateProject(ctx, p1)
		require.NoError(t, err)

		p2 := &models.Project{Name: "Proj 2", Slug: "duplicate-slug", Status: "active"}
		err = store.CreateProject(ctx, p2)
		
		assert.ErrorIs(t, err, project.ErrDuplicateSlug)
	})

	runTest(t, db, "Get non-existent project returns error", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		_, err := store.GetProject(ctx, uuid.New())
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})

	runTest(t, db, "Get project owner of project", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		// p := testutils.SelectRandomUser()
	})
}
