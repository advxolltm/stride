package project_test

import (
	"backend/db/project"
	userStore "backend/db/user"
	"backend/models"
	"backend/testutils"
	"context"
	"fmt"
	"os"
	"testing"
	"time"

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
		owner := testutils.SelectRandomUser(t, db)
		p := &models.Project{
			Name:        "Test Project",
			Slug:        "test-project-slug",
			Description: &desc,
			Status:      "active",
			CreatedBy:   &owner.ID,
		}

		err := store.CreateProject(ctx, p)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, p.ID)

		fetchedProj, err := store.GetProject(ctx, p.ID)
		require.NoError(t, err)
		assert.Equal(t, p.Name, fetchedProj.Name)
		assert.Equal(t, p.Slug, fetchedProj.Slug)
		assert.NotNil(t, p.Creator)
		assert.NotNil(t, p.Members)
		assert.Greater(t, len(p.Members), 0)
		assert.NotNil(t, p.Skills)
	})

	runTest(t, db, "Update Project correctly changes the fields", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj := testutils.SelectRandomProject(t, db)

		name := "PipiPupu"
		slug := "PipiPupu-slug"
		description := "new description"
		status := "archived"

		update := project.UpdateProjectFields{
			Name:        &name,
			Slug:        &slug,
			Description: &description,
			Status:      &status,
			UpdatedAt:   time.Now(),
		}

		updatedProj, err := store.UpdateProject(ctx, proj.ID, update)
		require.NoError(t, err)
		assert.Equal(t, *update.Name, updatedProj.Name)
		assert.Equal(t, *update.Slug, updatedProj.Slug)
		assert.Equal(t, *update.Description, *updatedProj.Description)
		assert.Equal(t, *update.Status, updatedProj.Status)

	})

	runTest(t, db, "Updating nonexistent project returns ErrProjectNotFound", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		name := "PipiPupu"
		slug := "PipiPupu-slug"
		description := "new description"
		status := "archived"

		update := project.UpdateProjectFields{
			Name:        &name,
			Slug:        &slug,
			Description: &description,
			Status:      &status,
			UpdatedAt:   time.Now(),
		}

		_, err := store.UpdateProject(ctx, uuid.New(), update)
		assert.ErrorIs(t, err, project.ErrProjectNotFound)
	})

	runTest(t, db, "Updating project with duplicate slug returns ErrDuplicateSlug", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj1 := testutils.SelectRandomProject(t, db)
		proj2 := testutils.SelectRandomProject(t, db)

		slug := "duplicate-slug"

		update := project.UpdateProjectFields{
			Slug:      &slug,
			UpdatedAt: time.Now(),
		}

		_, err := store.UpdateProject(ctx, proj1.ID, update)
		require.NoError(t, err)

		_, err = store.UpdateProject(ctx, proj2.ID, update)
		assert.ErrorIs(t, err, project.ErrDuplicateSlug)
	})

	runTest(t, db, "Delete project successfully deletes the project", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj := testutils.SelectRandomProject(t, db)

		_, beforeErr := store.GetProject(ctx, proj.ID)
		require.NoError(t, beforeErr)

		err := store.DeleteProject(ctx, proj.ID)
		require.NoError(t, err)

		_, AfterErr := store.GetProject(ctx, proj.ID)
		assert.ErrorIs(t, AfterErr, project.ErrProjectNotFound)
	})

	runTest(t, db, "Deleting a project that does not exist give ErrProjectNotFound", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		err := store.DeleteProject(ctx, uuid.New())
		assert.ErrorIs(t, err, project.ErrProjectNotFound)
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
		assert.ErrorIs(t, err, project.ErrProjectNotFound)
	})

	runTest(t, db, "Get project returns correct project", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		project := testutils.SelectRandomProject(t, db)

		retProj, getErr := store.GetProject(ctx, project.ID)
		require.NoError(t, getErr)

		assert.Equal(t, project.ID, retProj.ID)
		assert.Equal(t, project.CreatedAt, retProj.CreatedAt)
		assert.Equal(t, project.CreatedBy, retProj.CreatedBy)

		result := db.WithContext(ctx).Preload("Creator").Preload("Members").Preload("Skills").First(&project, "id = ?", project.ID)
		require.NoError(t, result.Error)

		assert.Equal(t, project, *retProj)
	})

	runTest(t, db, "Get Project Members returns correct list", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		project := testutils.SelectRandomProject(t, db)

		result := db.WithContext(ctx).Preload("Members").Preload("Members.User").First(&project, "id = ?", project.ID)
		require.NoError(t, result.Error)

		retMembers, getErr := store.GetProjectMembers(ctx, project.ID)
		require.NoError(t, getErr)

		assert.Equal(t, project.Members, retMembers)
	})

	runTest(t, db, "Get Project Skills returns correct list", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj1 := testutils.GenerateRandomProject([]models.User{testutils.SelectRandomUser(t, db)})

		proj1.Skills = []models.ProjectSkill{
			{
				ProjectID: proj1.ID,
				Name:      "Go",
			},
			{
				ProjectID: proj1.ID,
				Name:      "PostgreSQL",
			},
		}

		createErr := db.Create(&proj1)
		require.NoError(t, createErr.Error)

		retSkills, getErr := store.GetProjectSkills(ctx, proj1.ID)
		require.NoError(t, getErr)

		assert.Len(t, retSkills, 2)
		assert.Equal(t, proj1.Skills, retSkills)
	})

	runTest(t, db, "Get projectmembers returns an empty list when no skills", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj1 := testutils.GenerateRandomProject([]models.User{testutils.SelectRandomUser(t, db)})
		createErr := db.Create(&proj1)
		require.NoError(t, createErr.Error)

		retSkills, getErr := store.GetProjectSkills(ctx, proj1.ID)
		require.NoError(t, getErr)

		assert.Len(t, retSkills, 0)
	})

	runTest(t, db, "Get projectmembers returns ErrProjectNotFound when project does not exist", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj1 := testutils.GenerateRandomProject([]models.User{testutils.SelectRandomUser(t, db)})

		_, getErr := store.GetProjectMembers(ctx, proj1.ID)
		assert.ErrorIs(t, getErr, project.ErrProjectNotFound)
	})

	runTest(t, db, "Get projectskills returns only owner when no members", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj1 := testutils.GenerateRandomProject([]models.User{testutils.SelectRandomUser(t, db)})
		createErr := db.Create(&proj1)
		require.NoError(t, createErr.Error)

		retMembers, getErr := store.GetProjectMembers(ctx, proj1.ID)
		require.NoError(t, getErr)

		assert.Len(t, retMembers, 0)
	})

	runTest(t, db, "Get projectskills returns ErrProjectNotFound when project does not exist", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj1 := testutils.GenerateRandomProject([]models.User{testutils.SelectRandomUser(t, db)})

		_, getErr := store.GetProjectSkills(ctx, proj1.ID)
		assert.ErrorIs(t, getErr, project.ErrProjectNotFound)
	})

	runTest(t, db, "User without projects get an empty list", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		user := testutils.GenerateRandomUser()
		uStore := userStore.NewUserStore(db)
		uStore.CreateUser(ctx, &user)

		projects, err := store.GetAllProjects(ctx, &user.ID)
		require.NoError(t, err)
		assert.Len(t, projects, 0)
	})

	runTest(t, db, "UserID does not exist returns error", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		user := testutils.GenerateRandomUser()

		_, err := store.GetAllProjects(ctx, &user.ID)
		assert.ErrorIs(t, err, project.ErrNonExistentUser)
	})

	runTest(t, db, "User with multiple projects gets them all returned", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		user := testutils.GenerateRandomUser()
		uStore := userStore.NewUserStore(db)
		uStore.CreateUser(ctx, &user)

		proj1 := testutils.GenerateRandomProject([]models.User{user})
		proj2 := testutils.GenerateRandomProject([]models.User{user})
		proj3 := testutils.GenerateRandomProject([]models.User{user})

		projes := []*models.Project{&proj1, &proj2, &proj3}

		createErr := db.Create(projes)
		require.NoError(t, createErr.Error)

		userProjects, getProjErr := store.GetAllProjects(ctx, &user.ID)
		require.NoError(t, getProjErr)
		assert.Len(t, userProjects, 3)
	})

	runTest(t, db, "AddUsersToProject adds users to the project", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj := testutils.SelectRandomProject(t, db)
		user1 := testutils.GenerateRandomUser()
		user2 := testutils.GenerateRandomUser()

		membersBefore, errBefore := store.GetProjectMembers(ctx, proj.ID)
		require.NoError(t, errBefore)
		count := len(membersBefore)

		createErr1 := db.Create(&user1)
		createErr2 := db.Create(&user2)
		require.NoError(t, createErr1.Error)
		require.NoError(t, createErr2.Error)

		membersToAdd := []*models.ProjectMember{
			{
				UserID:    user1.ID,
				ProjectID: proj.ID,
				Role:      "boss",
			},
			{
				UserID:    user2.ID,
				ProjectID: proj.ID,
				Role:      "plebian",
			},
		}

		err := store.AddUsersToProject(ctx, membersToAdd)
		require.NoError(t, err)
		assert.Len(t, membersToAdd, 2)
		assert.NotNil(t, membersToAdd[0].ID)
		assert.NotNil(t, membersToAdd[1].ID)

		members, err := store.GetProjectMembers(ctx, proj.ID)
		require.NoError(t, err)
		assert.Len(t, members, count+2)
	})

	runTest(t, db, "AddUsersToProject give ErrUserAlreadyMember error when adding a duplicate Member", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj := testutils.SelectRandomProject(t, db)
		user := testutils.GenerateRandomUser()

		createErr := db.Create(&user)
		require.NoError(t, createErr.Error)

		member := &models.ProjectMember{
			UserID:    user.ID,
			ProjectID: proj.ID,
			Role:      "boss",
		}

		err := store.AddUsersToProject(ctx, []*models.ProjectMember{member})
		require.NoError(t, err)

		member = &models.ProjectMember{
			UserID:    user.ID,
			ProjectID: proj.ID,
			Role:      "boss",
		}

		err = store.AddUsersToProject(ctx, []*models.ProjectMember{member})
		assert.ErrorIs(t, err, project.ErrUserAlreadyMember)
	})

	runTest(t, db, "AddUsersToProject give ErrNonExistentUser error when user does not exist", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj := testutils.SelectRandomProject(t, db)

		member := &models.ProjectMember{
			UserID:    uuid.New(),
			ProjectID: proj.ID,
			Role:      "boss",
		}

		err := store.AddUsersToProject(ctx, []*models.ProjectMember{member})
		assert.ErrorIs(t, err, project.ErrNonExistentUser)
	})

	runTest(t, db, "AddUsersToProject give ErrProjectNotFound error when project does not exist", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		user := testutils.GenerateRandomUser()

		createErr := db.Create(&user)
		require.NoError(t, createErr.Error)

		member := &models.ProjectMember{
			UserID:    user.ID,
			ProjectID: uuid.New(),
			Role:      "boss",
		}

		err := store.AddUsersToProject(ctx, []*models.ProjectMember{member})
		assert.ErrorIs(t, err, project.ErrProjectNotFound)
	})

	runTest(t, db, "RemoveUserFromProject removes the user from the project", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj := testutils.SelectRandomProject(t, db)

		user, err := store.GetProjectMembers(ctx, proj.ID)
		require.NoError(t, err)
		require.Greater(t, len(user), 0)

		err = store.RemoveUserFromProject(ctx, user[0].UserID, proj.ID)
		require.NoError(t, err)

		members, err := store.GetProjectMembers(ctx, proj.ID)
		require.NoError(t, err)

		for _, m := range members {
			assert.NotEqual(t, user[0].UserID, m.UserID)
		}
	})

	runTest(t, db, "RemoveUserFromProject returns error when user is not a member", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj := testutils.SelectRandomProject(t, db)

		user := testutils.GenerateRandomUser()

		createErr := db.Create(&user)
		require.NoError(t, createErr.Error)

		err := store.RemoveUserFromProject(ctx, user.ID, proj.ID)
		assert.ErrorIs(t, err, project.ErrNonExistentUser)
	})

	runTest(t, db, "RemoveUserFromProject returns error when project does not exist", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		user := testutils.GenerateRandomUser()

		createErr := db.Create(&user)
		require.NoError(t, createErr.Error)

		err := store.RemoveUserFromProject(ctx, user.ID, uuid.New())
		assert.ErrorIs(t, err, project.ErrProjectNotFound)
	})

	runTest(t, db, "AddProjectSkill adds a skill to the project", func(t *testing.T, db *gorm.DB, store project.ProjectStore) {
		proj := testutils.SelectRandomProject(t, db)

		skillName := "Golang"
		skillDesc := "Go programming language"

		ps := &models.ProjectSkill{
			ProjectID:   proj.ID,
			Name:        skillName,
			Description: &skillDesc,
		}

		err := store.AddProjectSkill(ctx, ps)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, ps.ID)

		skill := db.
			assert.Equal(t, skillName, skill.Name)
		assert.Equal(t, skillDesc, *skill.Description)

		skills, err := store.GetProjectSkills(ctx, proj.ID)
		require.NoError(t, err)

		found := false
		for _, s := range skills {
			if s.ID == skill.ID {
				found = true
				assert.Equal(t, skillName, s.Name)
				assert.Equal(t, skillDesc, *s.Description)
				break
			}
		}
		assert.True(t, found)
	})

}
