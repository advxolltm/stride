package project_test

import (
	"backend/db/project"
	userStore "backend/db/user"
	"backend/models"
	projectService "backend/services/project"
	userService "backend/services/user"
	"backend/testutils"
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var db *gorm.DB

func newTestProjectService(db *gorm.DB) (projectService.ProjectService, userService.UserService) {
	store := project.NewProjectStore(db)
	uStore := userStore.NewUserStore(db)
	return projectService.NewProjectService(store), userService.NewUserService(uStore)
}

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, true, true)
}

func runTest(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, projectService.ProjectService, userService.UserService)) {
	t.Run(name, func(t *testing.T) {

		db.Transaction(func(tx *gorm.DB) error {
			service, uServ := newTestProjectService(tx)
			f(t, tx, service, uServ)
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}

func TestProjectService(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "Successfully create and get project", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		desc := "Service Tests"

		newUser, err := userServ.CreateUser(ctx, "projectowner", "owner@test.com", "Password123!")
		require.NoError(t, err)

		p, err := service.CreateProject(ctx, &newUser.ID, "Service Project", "service-slug", &desc, "active")
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, p.ID)
		assert.Equal(t, newUser.ID, *p.CreatedBy)

		fetchedProj, err := service.GetProject(ctx, p.ID)

		assert.NoError(t, err)
		assert.Equal(t, p.Name, fetchedProj.Name)
		assert.Equal(t, "service-slug", fetchedProj.Slug)
	})

	runTest(t, db, "Get non-existent project returns error", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj, err := service.GetProject(ctx, uuid.New())

		assert.ErrorIs(t, err, projectService.ErrProjectNotFound)
		assert.Nil(t, proj)
	})

	runTest(t, db, "Duplicate slug returns service error wrapper", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		desc := "Duplicate test"
		_, err := service.CreateProject(ctx, nil, "First", "shared-slug", &desc, "active")
		require.NoError(t, err)

		_, err = service.CreateProject(ctx, nil, "Second", "shared-slug", &desc, "active")

		assert.ErrorIs(t, err, projectService.ErrDuplicateSlug)
	})

	runTest(t, db, "Create new project and fetch it", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		desc := "Test Description"
		owner := testutils.SelectRandomUser(t, db)

		p, err := service.CreateProject(ctx, &owner.ID, "New Project", "new-project-slug", &desc, "active")
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, p.ID)

		assert.Equal(t, "New Project", p.Name)
		assert.Equal(t, "new-project-slug", p.Slug)
		assert.Equal(t, &desc, p.Description)
		assert.Equal(t, &owner.ID, p.CreatedBy)

		fetchedProj, err := service.GetProject(ctx, p.ID)
		require.NoError(t, err)
		assert.Equal(t, p.Name, fetchedProj.Name)
		assert.Equal(t, p.Slug, fetchedProj.Slug)
		assert.NotNil(t, p.Creator)
		assert.NotNil(t, p.Members)
		assert.Greater(t, len(p.Members), 0)
		assert.NotNil(t, p.Skills)
	})

	runTest(t, db, "Update project corretly changes the fields", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj := testutils.SelectRandomProject(t, db)

		name := "PipiPupu"
		slug := "PipiPupu-slug"
		description := "new description"
		status := "archived"

		updatedProj, err := service.UpdateProject(ctx, proj.ID, projectService.UpdateProjectInput{
			Name:        &name,
			Slug:        &slug,
			Description: &description,
			Status:      &status,
		})
		require.NoError(t, err)
		assert.Equal(t, name, updatedProj.Name)
		assert.Equal(t, slug, updatedProj.Slug)
		assert.Equal(t, description, *updatedProj.Description)
		assert.Equal(t, status, updatedProj.Status)
	})

	runTest(t, db, "Update non-existent project returns error", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		name := "PipiPupu"
		slug := "PipiPupu-slug"
		description := "new description"
		status := "archived"

		_, err := service.UpdateProject(ctx, uuid.New(), projectService.UpdateProjectInput{
			Name:        &name,
			Slug:        &slug,
			Description: &description,
			Status:      &status,
		})
		assert.ErrorIs(t, err, projectService.ErrProjectNotFound)
	})

	runTest(t, db, "Update Project with duplicate slug returns error", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj1 := testutils.SelectRandomProject(t, db)
		proj2 := testutils.SelectRandomProject(t, db)

		slug := "duplicate-slug"

		update := projectService.UpdateProjectInput{
			Slug: &slug,
		}

		_, err := service.UpdateProject(ctx, proj1.ID, update)
		require.NoError(t, err)

		_, err = service.UpdateProject(ctx, proj2.ID, update)
		assert.ErrorIs(t, err, projectService.ErrDuplicateSlug)
	})

	runTest(t, db, "Delete project successfully deletes the project", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj := testutils.SelectRandomProject(t, db)

		_, beforeErr := service.GetProject(ctx, proj.ID)
		require.NoError(t, beforeErr)

		err := service.DeleteProject(ctx, proj.ID)
		require.NoError(t, err)

		_, AfterErr := service.GetProject(ctx, proj.ID)
		assert.ErrorIs(t, AfterErr, projectService.ErrProjectNotFound)
	})

	runTest(t, db, "Get project returns correct project", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		project := testutils.SelectRandomProject(t, db)

		retProj, getErr := service.GetProject(ctx, project.ID)
		require.NoError(t, getErr)

		assert.Equal(t, project.ID, retProj.ID)
		assert.Equal(t, project.CreatedAt, retProj.CreatedAt)
		assert.Equal(t, project.CreatedBy, retProj.CreatedBy)

		result := db.WithContext(ctx).Preload("Creator").Preload("Members").Preload("Members.User").Preload("Skills").First(&project, "id = ?", project.ID)
		require.NoError(t, result.Error)

		project.Tasks = nil
		project.Messages = nil
		project.Whiteboards = nil

		retProj.Tasks = nil
		retProj.Messages = nil
		retProj.Whiteboards = nil

		assert.Equal(t, project, *retProj)
	})

	runTest(t, db, "Get Project Members returns correct list", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		project := testutils.SelectRandomProject(t, db)

		result := db.WithContext(ctx).Preload("Members").Preload("Members.User").First(&project, "id = ?", project.ID)
		require.NoError(t, result.Error)

		retMembers, getErr := service.GetProjectMembers(ctx, project.ID)
		require.NoError(t, getErr)

		assert.Equal(t, project.Members, retMembers)
	})

	runTest(t, db, "Get Project Skills returns correct list", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
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

		retSkills, getErr := service.GetProjectSkills(ctx, proj1.ID)
		require.NoError(t, getErr)

		assert.Len(t, retSkills, 2)
		assert.Equal(t, proj1.Skills, retSkills)
	})
	runTest(t, db, "Get projectskills returns an empty list when no skills", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj1 := testutils.GenerateRandomProject([]models.User{testutils.SelectRandomUser(t, db)})
		createErr := db.Create(&proj1)
		require.NoError(t, createErr.Error)

		retSkills, getErr := service.GetProjectSkills(ctx, proj1.ID)
		require.NoError(t, getErr)

		assert.Len(t, retSkills, 0)
	})

	runTest(t, db, "Get projectmembers returns ErrProjectNotFound when project does not exist", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		_, getErr := service.GetProjectMembers(ctx, uuid.New())
		assert.ErrorIs(t, getErr, projectService.ErrProjectNotFound)
	})
	runTest(t, db, "Get projectsmembers returns only owner when no members", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj1 := testutils.GenerateRandomProject([]models.User{testutils.SelectRandomUser(t, db)})
		createErr := db.Create(&proj1)
		require.NoError(t, createErr.Error)

		retMembers, getErr := service.GetProjectMembers(ctx, proj1.ID)
		require.NoError(t, getErr)

		assert.Len(t, retMembers, 0)
	})
	runTest(t, db, "Get projectskills returns ErrProjectNotFound when project does not exist", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj1 := testutils.GenerateRandomProject([]models.User{testutils.SelectRandomUser(t, db)})

		_, getErr := service.GetProjectSkills(ctx, proj1.ID)
		assert.ErrorIs(t, getErr, projectService.ErrProjectNotFound)
	})

	runTest(t, db, "User without projects get an empty list", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		user := testutils.GenerateRandomUser()
		uStore := userStore.NewUserStore(db)
		uStore.CreateUser(ctx, &user)

		projects, err := service.GetAllProjects(ctx, user.ID)
		require.NoError(t, err)
		assert.Len(t, projects, 0)
	})

	runTest(t, db, "UserID does not exist returns error", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		_, err := service.GetAllProjects(ctx, uuid.New())
		assert.ErrorIs(t, err, projectService.ErrNonExistentUser)
	})

	runTest(t, db, "User with multiple projects gets them all returned", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		user := testutils.GenerateRandomUser()
		uStore := userStore.NewUserStore(db)
		uStore.CreateUser(ctx, &user)

		proj1 := testutils.GenerateRandomProject([]models.User{user})
		proj2 := testutils.GenerateRandomProject([]models.User{user})
		proj3 := testutils.GenerateRandomProject([]models.User{user})

		proj1.Slug = "proj1-slug"
		proj2.Slug = "proj2-slug"
		proj3.Slug = "proj3-slug"

		projes := []*models.Project{&proj1, &proj2, &proj3}

		createErr := db.Create(projes)
		require.NoError(t, createErr.Error)

		userProjects, getProjErr := service.GetAllProjects(ctx, user.ID)
		require.NoError(t, getProjErr)
		assert.Len(t, userProjects, 3)
	})

	runTest(t, db, "AddUsersToProject adds users to the project", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj := testutils.SelectRandomProject(t, db)
		user1 := testutils.GenerateRandomUser()
		user2 := testutils.GenerateRandomUser()

		membersBefore, errBefore := service.GetProjectMembers(ctx, proj.ID)
		require.NoError(t, errBefore)
		count := len(membersBefore)

		createErr1 := db.Create(&user1)
		createErr2 := db.Create(&user2)
		require.NoError(t, createErr1.Error)
		require.NoError(t, createErr2.Error)

		membersToAdd := []projectService.AddMemberRequest{
			{
				UserId: user1.ID,
				Role:   "boss",
			},
			{
				UserId: user2.ID,
				Role:   "plebian",
			},
		}

		newMembers, err := service.AddUsersToProject(ctx, membersToAdd, proj.ID)
		require.NoError(t, err)
		assert.Len(t, membersToAdd, 2)
		assert.NotNil(t, newMembers[0].ID)
		assert.NotNil(t, newMembers[1].ID)

		members, err := service.GetProjectMembers(ctx, proj.ID)
		require.NoError(t, err)
		assert.Len(t, members, count+2)
	})

	runTest(t, db, "AddUsersToProject give ErrUserAlreadyMember error when adding a duplicate Member", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj := testutils.SelectRandomProject(t, db)
		user := testutils.GenerateRandomUser()

		createErr := db.Create(&user)
		require.NoError(t, createErr.Error)

		member := projectService.AddMemberRequest{
			UserId: user.ID,
			Role:   "boss",
		}

		_, err := service.AddUsersToProject(ctx, []projectService.AddMemberRequest{member}, proj.ID)
		require.NoError(t, err)

		_, err = service.AddUsersToProject(ctx, []projectService.AddMemberRequest{member}, proj.ID)
		assert.ErrorIs(t, err, projectService.ErrUserAlreadyMember)
	})

	runTest(t, db, "AddUsersToProject give ErrNonExistentUser error when user does not exist", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj := testutils.SelectRandomProject(t, db)

		member := projectService.AddMemberRequest{
			UserId: uuid.New(),
			Role:   "boss",
		}

		_, err := service.AddUsersToProject(ctx, []projectService.AddMemberRequest{member}, proj.ID)
		assert.ErrorIs(t, err, projectService.ErrNonExistentUser)
	})

	runTest(t, db, "AddUsersToProject give ErrProjectNotFound error when project does not exist", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		user := testutils.GenerateRandomUser()

		createErr := db.Create(&user)
		require.NoError(t, createErr.Error)

		member := projectService.AddMemberRequest{
			UserId: user.ID,
			Role:   "boss",
		}

		_, err := service.AddUsersToProject(ctx, []projectService.AddMemberRequest{member}, uuid.New())
		assert.ErrorIs(t, err, projectService.ErrProjectNotFound)
	})

	runTest(t, db, "RemoveUserFromProject removes the user from the project", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj := testutils.SelectRandomProject(t, db)

		user, err := service.GetProjectMembers(ctx, proj.ID)
		require.NoError(t, err)
		require.Greater(t, len(user), 0)

		err = service.RemoveUserFromProject(ctx, user[0].UserID, proj.ID)
		require.NoError(t, err)

		members, err := service.GetProjectMembers(ctx, proj.ID)
		require.NoError(t, err)

		for _, m := range members {
			assert.NotEqual(t, user[0].UserID, m.UserID)
		}
	})

	runTest(t, db, "RemoveUserFromProject returns error when user is not a member", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj := testutils.SelectRandomProject(t, db)

		user := testutils.GenerateRandomUser()

		createErr := db.Create(&user)
		require.NoError(t, createErr.Error)

		err := service.RemoveUserFromProject(ctx, user.ID, proj.ID)
		assert.ErrorIs(t, err, projectService.ErrNonExistentMember)
	})

	runTest(t, db, "RemoveUserFromProject returns error when project does not exist", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		user := testutils.GenerateRandomUser()

		createErr := db.Create(&user)
		require.NoError(t, createErr.Error)

		err := service.RemoveUserFromProject(ctx, user.ID, uuid.New())
		assert.ErrorIs(t, err, projectService.ErrProjectNotFound)
	})

	runTest(t, db, "AddProjectSkill adds a skill to the project", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj := testutils.SelectRandomProject(t, db)

		skillName := "Golang"
		skillDesc := "Go programming language"

		ps, err := service.AddProjectSkill(ctx, proj.ID, skillName, &skillDesc)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, ps.ID)

		loadErr := db.Preload("Skills").First(&proj, "id = ?", proj.ID)
		require.NoError(t, loadErr.Error)

		skills := proj.Skills

		found := false
		for _, s := range skills {
			if s.ID == ps.ID {
				found = true
				assert.Equal(t, skillName, s.Name)
				assert.Equal(t, skillDesc, *s.Description)
				break
			}
		}
		assert.True(t, found)
	})

	runTest(t, db, "AddProjectSkill returns error when project does not exist", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		skillName := "Golang"
		skillDesc := "Go language"

		_, err := service.AddProjectSkill(ctx, uuid.New(), skillName, &skillDesc)
		assert.ErrorIs(t, err, projectService.ErrProjectNotFound)
	})

	runTest(t, db, "RemoveProjectSkill removes the skill from the project", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		proj := testutils.SelectRandomProject(t, db)
		desc := "dingus"

		skill, createErr := service.AddProjectSkill(ctx, proj.ID, "bingus", &desc)
		require.NoError(t, createErr)

		err := service.RemoveProjectSkill(ctx, skill.ID)
		require.NoError(t, err)

		skills, err := service.GetProjectSkills(ctx, proj.ID)
		require.NoError(t, err)

		for _, s := range skills {
			assert.NotEqual(t, skill.ID, s.ID)
		}
	})

	runTest(t, db, "RemoveProjectSkill returns error when skill does not exist", func(t *testing.T, db *gorm.DB, service projectService.ProjectService, userServ userService.UserService) {
		err := service.RemoveProjectSkill(ctx, uuid.New())
		assert.ErrorIs(t, err, projectService.ErrNonExistentProjectSkill)
	})

}
