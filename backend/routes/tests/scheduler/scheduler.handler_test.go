package scheduler_routes_test

import (
	"backend/db/project"
	"backend/db/task"
	userStore "backend/db/user"
	"backend/models"
	projHandler "backend/routes/projects"
	authService "backend/services/auth"
	projectService "backend/services/project"
	schedulerService "backend/services/scheduler"
	taskService "backend/services/task"
	userService "backend/services/user"
	"backend/testutils"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var db *gorm.DB
var rdb *redis.Client

type ReturnAssignment struct {
	UserID uuid.UUID `json:"user_id"`
	TaskID uuid.UUID `json:"task_id"`
}

type AssignmentStruct struct {
	NewAssignments     []ReturnAssignment `json:"new_assignments"`
	ChangedAssignments []ReturnAssignment `json:"changed_assignments"`
}

type SchedulingRequest struct {
	TaskIDs []uuid.UUID `json:"task_ids"`
	UserIDs []uuid.UUID `json:"user_ids"`
}

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

func getCookie(t *testing.T, authServ authService.AuthService, email string, password string) *http.Cookie {
	jwt, _, err := authServ.AuthenticateUser(context.Background(), email, password)
	require.NoError(t, err)
	return &http.Cookie{Name: "sessionToken", Value: string(jwt)}
}

func setupTestingProjectHTTP(ctx context.Context, db *gorm.DB, pServe projectService.ProjectService, uServ userService.UserService, loginUser models.User, t *testing.T) (*models.Project, []models.User, []models.ProjectMember, []models.ProjectSkill) {
	u2, _ := uServ.CreateUser(ctx, "user2"+uuid.NewString()[:8], "u2"+uuid.NewString()[:8]+"@t.com", "Password123!")

	desc := "desc"
	proj, _ := pServe.CreateProject(ctx, &loginUser.ID, "Proj", "proj-"+uuid.NewString()[:8], &desc, "active")

	_, err_add := pServe.AddUsersToProject(ctx, []projectService.AddMemberRequest{
		{UserId: u2.ID, Role: "member"},
	}, proj.ID)

	require.NoError(t, err_add)

	pms, _ := pServe.GetProjectMembers(ctx, proj.ID)

	var pm1, pm2 models.ProjectMember
	for _, pm := range pms {
		if pm.UserID == loginUser.ID {
			pm1 = pm
		}
		if pm.UserID == u2.ID {
			pm2 = pm
		}
	}

	skGo, err := pServe.AddProjectSkill(ctx, proj.ID, "Go", nil)
	require.NoError(t, err)

	skReact, err := pServe.AddProjectSkill(ctx, proj.ID, "React", nil)
	require.NoError(t, err)

	_, err = uServ.SetWorkingHours(ctx, proj.ID, 40, loginUser.ID)
	require.NoError(t, err)
	_, err = uServ.SetWorkingHours(ctx, proj.ID, 40, u2.ID)
	require.NoError(t, err)

	_, err = uServ.AddSkill(ctx, proj.ID, skGo.ID, loginUser.ID)
	require.NoError(t, err)
	_, err = uServ.AddSkill(ctx, proj.ID, skReact.ID, u2.ID)
	require.NoError(t, err)

	return proj, []models.User{loginUser, *u2}, []models.ProjectMember{pm1, pm2}, []models.ProjectSkill{*skGo, *skReact}
}

func runSchedulerTest(t *testing.T, name string, f func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User)) {
	t.Run(name, func(t *testing.T) {
		t.Setenv("SESSION_SECRET", "super-secret")
		err := db.Transaction(func(tx *gorm.DB) error {
			pStore := project.NewProjectStore(tx)
			pServ := projectService.NewProjectService(pStore)
			uStore := userStore.NewUserStore(tx)
			uServ := userService.NewUserService(uStore)
			aServ := authService.NewAuthenticationService(uServ)
			tStore := task.NewTaskStore(tx)
			tServ := taskService.NewTaskService(tStore, pServ)
			sServ := schedulerService.NewSchedulerService(tServ, pServ)

			handler := projHandler.NewProjectsGroup(pServ, nil, nil, nil, aServ, rdb, sServ, tServ)

			e := echo.New()
			handler.AddRoutes(e.Group("/api"))

			loginUser, err := uServ.CreateUser(context.Background(), "cookieMonster"+uuid.NewString()[:8], "cookie"+uuid.NewString()[:8]+"@monster.com", "nomnom*!")
			require.NoError(t, err)
			cookie := getCookie(t, aServ, loginUser.Email, "nomnom*!")

			f(t, tx, aServ, pServ, uServ, tServ, sServ, e, cookie, *loginUser)
			return fmt.Errorf("rollback %s", t.Name())
		})
		if err == nil || err.Error() != fmt.Sprintf("rollback %s", t.Name()) {
			t.Fatalf("Expected rollback error, got %v", err)
		}
	})
}

func TestSchedulerRouteHandler_Integration(t *testing.T) {
	ctx := context.Background()

	runSchedulerTest(t, "POST Schedule Tasks - Assign Feasible Schedule", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, users, _, skills := setupTestingProjectHTTP(ctx, tx, ps, us, loginUser, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)
		expHours := 20

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		require.NoError(t, ts.CreateTask(ctx, &task1))

		task2 := testutils.GenerateRandomTask([]models.Project{*proj})
		task2.StartDate = &startDate
		task2.DueDate = &dueDate
		task2.ExpectedDurationHours = &expHours
		task2.NeededSkills = []models.ProjectSkill{skills[1]}
		require.NoError(t, ts.CreateTask(ctx, &task2))

		reqBody := SchedulingRequest{
			TaskIDs: []uuid.UUID{task1.ID, task2.ID},
			UserIDs: []uuid.UUID{users[0].ID, users[1].ID},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/scheduler", proj.ID.String()), bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var assignments AssignmentStruct
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &assignments))
		assert.Equal(t, 2, len(assignments.NewAssignments))
	})

	runSchedulerTest(t, "POST Schedule Tasks - Respects Already Assigned Tasks", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, users, pms, skills := setupTestingProjectHTTP(ctx, tx, ps, us, loginUser, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)
		expHours := 20

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		require.NoError(t, ts.CreateTask(ctx, &task1))

		_, err := ts.AssignTask(ctx, task1.ID, pms[0].ID)
		require.NoError(t, err)

		task2 := testutils.GenerateRandomTask([]models.Project{*proj})
		task2.StartDate = &startDate
		task2.DueDate = &dueDate
		task2.ExpectedDurationHours = &expHours
		task2.NeededSkills = []models.ProjectSkill{skills[0]}
		require.NoError(t, ts.CreateTask(ctx, &task2))

		reqBody := SchedulingRequest{
			TaskIDs: []uuid.UUID{task2.ID},
			UserIDs: []uuid.UUID{users[0].ID, users[1].ID},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/scheduler", proj.ID.String()), bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var assignments AssignmentStruct
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &assignments))
		assert.Greater(t, len(assignments.NewAssignments), 0)
	})

	runSchedulerTest(t, "POST Schedule Tasks - Missing Start/Due Date", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, users, _, _ := setupTestingProjectHTTP(ctx, tx, ps, us, loginUser, t)

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = nil
		require.NoError(t, ts.CreateTask(ctx, &task1))

		reqBody := SchedulingRequest{
			TaskIDs: []uuid.UUID{task1.ID},
			UserIDs: []uuid.UUID{users[0].ID},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/scheduler", proj.ID.String()), bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusInternalServerError, rec.Code)
	})

	runSchedulerTest(t, "POST Schedule Tasks - Cross-Project Tasks Not Allowed", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		projA, users, _, _ := setupTestingProjectHTTP(ctx, tx, ps, us, loginUser, t)
		projB, _, _, _ := setupTestingProjectHTTP(ctx, tx, ps, us, loginUser, t)

		now := time.Now()
		due := now.AddDate(0, 0, 7)
		exp := 10

		taskA := testutils.GenerateRandomTask([]models.Project{*projA})
		taskA.StartDate = &now
		taskA.DueDate = &due
		taskA.ExpectedDurationHours = &exp
		require.NoError(t, ts.CreateTask(ctx, &taskA))

		taskB := testutils.GenerateRandomTask([]models.Project{*projB})
		taskB.StartDate = &now
		taskB.DueDate = &due
		taskB.ExpectedDurationHours = &exp
		require.NoError(t, ts.CreateTask(ctx, &taskB))

		reqBody := SchedulingRequest{
			TaskIDs: []uuid.UUID{taskA.ID, taskB.ID},
			UserIDs: []uuid.UUID{users[0].ID},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/scheduler", projA.ID.String()), bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusInternalServerError, rec.Code)
	})

	runSchedulerTest(t, "POST Schedule Tasks - Invalid User or Task ID", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, _, _, _ := setupTestingProjectHTTP(ctx, tx, ps, us, loginUser, t)

		now := time.Now()
		due := now.AddDate(0, 0, 7)
		exp := 10

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &now
		task1.DueDate = &due
		task1.ExpectedDurationHours = &exp
		require.NoError(t, ts.CreateTask(ctx, &task1))

		reqBody := SchedulingRequest{
			TaskIDs: []uuid.UUID{task1.ID},
			UserIDs: []uuid.UUID{testutils.RandomUUID(t)},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/scheduler", proj.ID.String()), bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusInternalServerError, rec.Code)
	})

	runSchedulerTest(t, "GET ScheduleProject - Assigns Unassigned Tasks", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, _, _, skills := setupTestingProjectHTTP(ctx, tx, ps, us, loginUser, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)
		expHours := 20

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		require.NoError(t, ts.CreateTask(ctx, &task1))

		task2 := testutils.GenerateRandomTask([]models.Project{*proj})
		task2.StartDate = &startDate
		task2.DueDate = &dueDate
		task2.ExpectedDurationHours = &expHours
		task2.NeededSkills = []models.ProjectSkill{skills[1]}
		require.NoError(t, ts.CreateTask(ctx, &task2))

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/scheduler", proj.ID.String()), nil)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var assignments AssignmentStruct
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &assignments))
		assert.Equal(t, 2, len(assignments.NewAssignments))
	})

	runSchedulerTest(t, "GET ScheduleProject - No Unassigned Tasks", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, _, pms, skills := setupTestingProjectHTTP(ctx, tx, ps, us, loginUser, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)
		expHours := 20

		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		require.NoError(t, ts.CreateTask(ctx, &task1))

		_, err := ts.AssignTask(ctx, task1.ID, pms[0].ID)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/scheduler", proj.ID.String()), nil)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var assignments AssignmentStruct
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &assignments))
		assert.Equal(t, 0, len(assignments.NewAssignments))
	})

	runSchedulerTest(t, "GET ScheduleProject - Invalid Project ID", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		req := httptest.NewRequest(http.MethodPost, "/api/projects/invalid-uuid-string/scheduler", nil)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	runSchedulerTest(t, "POST Schedule Tasks - Respects Already Assigned Tasks - Exceeds Capacity", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, ts taskService.TaskService, ss schedulerService.SchedulerService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		proj, users, pms, skills := setupTestingProjectHTTP(ctx, tx, ps, us, loginUser, t)

		startDate := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)
		dueDate := startDate.AddDate(0, 0, 7)

		expHours1 := 30
		task1 := testutils.GenerateRandomTask([]models.Project{*proj})
		task1.StartDate = &startDate
		task1.DueDate = &dueDate
		task1.ExpectedDurationHours = &expHours1
		task1.NeededSkills = []models.ProjectSkill{skills[0]}
		require.NoError(t, ts.CreateTask(ctx, &task1))

		_, err := ts.AssignTask(ctx, task1.ID, pms[0].ID)
		require.NoError(t, err)

		expHours2 := 20
		task2 := testutils.GenerateRandomTask([]models.Project{*proj})
		task2.StartDate = &startDate
		task2.DueDate = &dueDate
		task2.ExpectedDurationHours = &expHours2
		task2.NeededSkills = []models.ProjectSkill{skills[0]}
		require.NoError(t, ts.CreateTask(ctx, &task2))

		reqBody := SchedulingRequest{
			TaskIDs: []uuid.UUID{task2.ID},
			UserIDs: []uuid.UUID{users[0].ID, users[1].ID},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/scheduler", proj.ID.String()), bytes.NewBuffer(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var assignments AssignmentStruct
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &assignments))
		assert.Equal(t, 0, len(assignments.NewAssignments))
	})
}
