package scheduler_test

import (
	"backend/db/project"
	"backend/db/task"
	userStore "backend/db/user"
	"backend/models"
	projectService "backend/services/project"
	"backend/services/scheduler"
	taskService "backend/services/task"
	userService "backend/services/user"
	"backend/testutils"
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

func setupTestingProject(ctx context.Context, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, t *testing.T) (*models.Project, []models.User, []models.ProjectMember, []models.ProjectSkill) {
	u1, _ := uServ.CreateUser(ctx, "user1"+uuid.NewString()[:8], "u1"+uuid.NewString()[:8]+"@t.com", "Password123!")
	u2, _ := uServ.CreateUser(ctx, "user2"+uuid.NewString()[:8], "u2"+uuid.NewString()[:8]+"@t.com", "Password123!")

	desc := "desc"
	proj, _ := pServe.CreateProject(ctx, &u1.ID, "Proj", "proj-"+uuid.NewString()[:8], &desc, "active")

	_, err := pServe.AddUsersToProject(ctx, []projectService.AddMemberRequest{
		{UserId: u2.ID, Role: "member"},
	}, proj.ID)
	require.NoError(t, err)

	pms, err := pServe.GetProjectMembers(ctx, proj.ID)
	require.NoError(t, err)

	var pm1, pm2 models.ProjectMember
	for _, pm := range pms {
		if pm.UserID == u1.ID {
			pm1 = pm
		}
		if pm.UserID == u2.ID {
			pm2 = pm
		}
	}

	skGo, _ := pServe.AddProjectSkill(ctx, proj.ID, "Go", nil)
	skReact, _ := pServe.AddProjectSkill(ctx, proj.ID, "React", nil)

	// db.Model(&pm1).Update("working_hours", 40)
	// db.Model(&pm2).Update("working_hours", 40)
	// db.Model(&pm1).Association("Skills").Append(skGo)
	// db.Model(&pm2).Association("Skills").Append(skReact)

	_, err = uServ.SetWorkingHours(ctx, proj.ID, 40, u1.ID)
	require.NoError(t, err)
	_, err = uServ.SetWorkingHours(ctx, proj.ID, 40, u2.ID)
	require.NoError(t, err)

	_, err = uServ.AddSkill(ctx, proj.ID, skGo.ID, u1.ID)
	require.NoError(t, err)
	_, err = uServ.AddSkill(ctx, proj.ID, skReact.ID, u2.ID)
	require.NoError(t, err)

	return proj, []models.User{*u1, *u2}, []models.ProjectMember{pm1, pm2}, []models.ProjectSkill{*skGo, *skReact}
}

func newTestSchedulerService(db *gorm.DB) (projectService.ProjectService, userService.UserService, taskService.TaskService, scheduler.SchedulerService) {
	store := project.NewProjectStore(db)
	uStore := userStore.NewUserStore(db)
	tStore := task.NewTaskStore(db)
	pServe := projectService.NewProjectService(store)
	tServe := taskService.NewTaskService(tStore, pServe)

	return pServe, userService.NewUserService(uStore), tServe, scheduler.NewSchedulerService(tServe, pServe)
}

func runTest(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, projectService.ProjectService, userService.UserService, taskService.TaskService, scheduler.SchedulerService)) {
	t.Run(name, func(t *testing.T) {

		err := db.Transaction(func(tx *gorm.DB) error {
			service, uServ, tServe, sServe := newTestSchedulerService(tx)
			f(t, tx, service, uServ, tServe, sServe)
			return fmt.Errorf("rollback %s", t.Name())
		})
		if err == nil || err.Error() != fmt.Sprintf("rollback %s", t.Name()) {
			t.Fatalf("Expected rollback error, got %v", err)
		}

	})
}

func TestProjectService(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "Assign Feasible Schedule", func(t *testing.T, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, tServe taskService.TaskService, sServe scheduler.SchedulerService) {
		proj, users, members, skills := setupTestingProject(ctx, db, pServe, uServ, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)
		expHours := 20

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		err := tServe.CreateTask(ctx, &task1)
		require.NoError(t, err)

		task2 := testutils.GenerateRandomTask([]models.Project{*proj})
		task2.StartDate = &startDate
		task2.DueDate = &dueDate
		task2.ExpectedDurationHours = &expHours
		task2.NeededSkills = []models.ProjectSkill{skills[1]}
		err = tServe.CreateTask(ctx, &task2)
		require.NoError(t, err)

		req := scheduler.SchedulingRequest{
			ProjID:  proj.ID,
			UserIDs: []uuid.UUID{users[0].ID, users[1].ID},
			TaskIDs: []uuid.UUID{task1.ID, task2.ID},
		}

		assignments, err_s := sServe.ScheduleTasksToUsers(ctx, req)
		require.NoError(t, err_s)

		as_len := len(assignments.NewAssignments)

		fmt.Println(assignments)
		fmt.Println(members)

		assert.Equal(t, 2, as_len)

		for _, ass := range assignments.NewAssignments {
			if ass.TaskID == task1.ID {
				assert.Equal(t, users[0].ID, ass.UserID)
			}
			if ass.TaskID == task2.ID {
				assert.Equal(t, users[1].ID, ass.UserID)
			}
		}
	})
	runTest(t, db, "Respects Already Assigned Tasks", func(t *testing.T, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, tServe taskService.TaskService, sServe scheduler.SchedulerService) {
		proj, users, pms, skills := setupTestingProject(ctx, db, pServe, uServ, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)
		expHours := 20

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		err := tServe.CreateTask(ctx, &task1)
		require.NoError(t, err)

		_, err = tServe.AssignTask(ctx, task1.ID, pms[0].ID)
		require.NoError(t, err)

		task2 := testutils.GenerateRandomTask([]models.Project{*proj})
		task2.StartDate = &startDate
		task2.DueDate = &dueDate
		task2.ExpectedDurationHours = &expHours
		task2.NeededSkills = []models.ProjectSkill{skills[0]}
		err = tServe.CreateTask(ctx, &task2)
		require.NoError(t, err)

		req := scheduler.SchedulingRequest{
			ProjID:  proj.ID,
			UserIDs: []uuid.UUID{users[0].ID, users[1].ID},
			TaskIDs: []uuid.UUID{task2.ID},
		}

		assignments, err_s := sServe.ScheduleTasksToUsers(ctx, req)

		require.NoError(t, err_s)

		assert.Greater(t, len(assignments.NewAssignments), 0)

		hasAssignedTask2 := false
		for _, ass := range assignments.NewAssignments {
			if ass.TaskID == task2.ID {
				hasAssignedTask2 = true
				if ass.UserID != users[0].ID {
					t.Errorf("Task 2 should have been assigned to User 1")
				}
				assert.Equal(t, users[0].ID, ass.UserID)
			}
		}
		assert.True(t, hasAssignedTask2)
	})

	runTest(t, db, "Missing Start/Due Date", func(t *testing.T, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, tServe taskService.TaskService, sServe scheduler.SchedulerService) {
		proj, users, _, _ := setupTestingProject(ctx, db, pServe, uServ, t)

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = nil
		err := tServe.CreateTask(ctx, &task1)
		require.NoError(t, err)

		req := scheduler.SchedulingRequest{
			ProjID:  proj.ID,
			UserIDs: []uuid.UUID{users[0].ID},
			TaskIDs: []uuid.UUID{task1.ID},
		}

		_, err_s := sServe.ScheduleTasksToUsers(ctx, req)

		//require.Error(t, err_s, "some tasks are missing a start/due date.")
		assert.Error(t, err_s, "some tasks are missing a start/due date.")
	})

	runTest(t, db, "Cross-Project Tasks Not Allowed", func(t *testing.T, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, tServe taskService.TaskService, sServe scheduler.SchedulerService) {
		projA, users, _, _ := setupTestingProject(ctx, db, pServe, uServ, t)
		projB, _, _, _ := setupTestingProject(ctx, db, pServe, uServ, t)

		now := time.Now()
		due := now.AddDate(0, 0, 7)
		exp := 10

		taskA := testutils.GenerateRandomTask([]models.Project{*projA})
		taskA.StartDate = &now
		taskA.DueDate = &due
		taskA.ExpectedDurationHours = &exp
		err := tServe.CreateTask(ctx, &taskA)
		require.NoError(t, err)

		taskB := testutils.GenerateRandomTask([]models.Project{*projB})
		taskB.StartDate = &now
		taskB.DueDate = &due
		taskB.ExpectedDurationHours = &exp
		err = tServe.CreateTask(ctx, &taskB)
		require.NoError(t, err)

		req := scheduler.SchedulingRequest{
			ProjID:  projA.ID,
			UserIDs: []uuid.UUID{users[0].ID},
			TaskIDs: []uuid.UUID{taskA.ID, taskB.ID},
		}

		_, err_s := sServe.ScheduleTasksToUsers(ctx, req)
		assert.Error(t, err_s, "the tasks all have to belong to the specified project.")
	})

	runTest(t, db, "Invalid User or Task ID", func(t *testing.T, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, tServe taskService.TaskService, sServe scheduler.SchedulerService) {
		proj, _, _, _ := setupTestingProject(ctx, db, pServe, uServ, t)

		now := time.Now()
		due := now.AddDate(0, 0, 7)
		exp := 10

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &now
		task1.DueDate = &due
		task1.ExpectedDurationHours = &exp
		err := tServe.CreateTask(ctx, &task1)
		require.NoError(t, err)

		fakeUserID := testutils.RandomUUID(t)

		req := scheduler.SchedulingRequest{
			ProjID:  proj.ID,
			UserIDs: []uuid.UUID{fakeUserID},
			TaskIDs: []uuid.UUID{task1.ID},
		}

		_, err_s := sServe.ScheduleTasksToUsers(ctx, req)
		assert.Contains(t, err_s.Error(), "user is not a member of the project")
	})

	runTest(t, db, "ScheduleProject - Assigns Unassigned Tasks", func(t *testing.T, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, tServe taskService.TaskService, sServe scheduler.SchedulerService) {
		proj, users, _, skills := setupTestingProject(ctx, db, pServe, uServ, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)
		expHours := 20

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		err := tServe.CreateTask(ctx, &task1)
		require.NoError(t, err)

		task2 := testutils.GenerateRandomTask([]models.Project{*proj})
		task2.StartDate = &startDate
		task2.DueDate = &dueDate
		task2.ExpectedDurationHours = &expHours
		task2.NeededSkills = []models.ProjectSkill{skills[1]}
		err = tServe.CreateTask(ctx, &task2)
		require.NoError(t, err)

		assignments, err_s := sServe.ScheduleProject(ctx, proj.ID)
		require.NoError(t, err_s)

		assert.Equal(t, 2, len(assignments.NewAssignments))

		for _, ass := range assignments.NewAssignments {
			if ass.TaskID == task1.ID {
				assert.Equal(t, users[0].ID, ass.UserID)
			}
			if ass.TaskID == task2.ID {
				assert.Equal(t, users[1].ID, ass.UserID)
			}
		}
	})

	runTest(t, db, "ScheduleProject - No Unassigned Tasks", func(t *testing.T, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, tServe taskService.TaskService, sServe scheduler.SchedulerService) {
		proj, _, pms, skills := setupTestingProject(ctx, db, pServe, uServ, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)
		expHours := 20

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		err := tServe.CreateTask(ctx, &task1)
		require.NoError(t, err)

		_, err = tServe.AssignTask(ctx, task1.ID, pms[0].ID)
		require.NoError(t, err)

		assignments, err_s := sServe.ScheduleProject(ctx, proj.ID)
		require.NoError(t, err_s)

		assert.Equal(t, 0, len(assignments.NewAssignments))
	})

	runTest(t, db, "ScheduleProject, Invalid Project ID", func(t *testing.T, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, tServe taskService.TaskService, sServe scheduler.SchedulerService) {
		fakeProjID := testutils.RandomUUID(t)

		_, err_s := sServe.ScheduleProject(ctx, fakeProjID)
		assert.Error(t, err_s)
	})

	runTest(t, db, "Respects Already Assigned Tasks, Exceeds Capacity", func(t *testing.T, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, tServe taskService.TaskService, sServe scheduler.SchedulerService) {
		ctx := context.Background()
		proj, users, pms, skills := setupTestingProject(ctx, db, pServe, uServ, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)

		expHours1 := 30
		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours1
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		err := tServe.CreateTask(ctx, &task1)
		require.NoError(t, err)

		_, err = tServe.AssignTask(ctx, task1.ID, pms[0].ID)
		require.NoError(t, err)

		expHours2 := 20
		task2 := testutils.GenerateRandomTask([]models.Project{*proj})
		task2.StartDate = &startDate
		task2.DueDate = &dueDate
		task2.ExpectedDurationHours = &expHours2
		task2.NeededSkills = []models.ProjectSkill{skills[0]}
		err = tServe.CreateTask(ctx, &task2)
		require.NoError(t, err)

		req := scheduler.SchedulingRequest{
			ProjID:  proj.ID,
			UserIDs: []uuid.UUID{users[0].ID, users[1].ID},
			TaskIDs: []uuid.UUID{task2.ID},
		}

		assignments, err_s := sServe.ScheduleTasksToUsers(ctx, req)
		require.NoError(t, err_s)

		fmt.Println(assignments)
		fmt.Println(users[0].ID)

		assert.Equal(t, 0, len(assignments.NewAssignments))
	})

}
