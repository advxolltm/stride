package task

import (
	"backend/models"
	"backend/routes"
	"backend/testutils"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	notificationStore "backend/db/notification"
	projectStore "backend/db/project"
	taskStore "backend/db/task"
	userStore "backend/db/user"
	authService "backend/services/auth"
	notificationService "backend/services/notification"
	projectService "backend/services/project"
	taskService "backend/services/task"
	userService "backend/services/user"
)

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

func newTestTaskHandler(db *gorm.DB, rdb *redis.Client) taskRouteHandler {
	userStore := userStore.NewUserStore(db)
	projectStore := projectStore.NewProjectStore(db)
	taskStore := taskStore.NewTaskStore(db)
	notificationStore := notificationStore.NewNotificationStreamStore(rdb)

	userService := userService.NewUserService(userStore)
	projectService := projectService.NewProjectService(projectStore)
	authService := authService.NewAuthenticationService(userService)
	taskService := taskService.NewTaskService(taskStore, projectService)
	notificationService := notificationService.NewNotificationService(notificationStore)

	return taskRouteHandler{
		authService:         authService,
		taskService:         taskService,
		projectService:      projectService,
		notificationService: notificationService,
		rdb:                 rdb,
	}
}

func loginUser(t *testing.T, aService authService.AuthService, c *echo.Context, user models.User) {
	t.Helper()
	jwtStr, expiry, err := aService.AuthenticateUser(t.Context(), user.Email, "pwd")
	require.NoErrorf(t, err, "User: %s", user.Email)
	cookie := http.Cookie{
		Name:     authService.SessionTokenName,
		Value:    string(jwtStr),
		Expires:  expiry,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
	}
	c.Request().AddCookie(&cookie)
}

func parse[T any](t *testing.T, buf *bytes.Buffer) T {
	var parsed T
	err := json.Unmarshal(buf.Bytes(), &parsed)
	require.NoError(t, err, "failed to parse task response")
	return parsed
}

func assertEqualTaskResponse(t *testing.T, expected models.Task, actual routes.Task) {
	assert.Equal(t, expected.ID, actual.ID, "task.ID")
	assert.Equal(t, expected.ProjectID, actual.ProjectID, "task.ProjectID")
	assert.Equal(t, expected.CreatedBy, actual.CreatedBy, "task.CreatedBy")
	assert.Equal(t, expected.Title, actual.Title, "task.Title")
	assert.Equal(t, expected.Description, actual.Description, "task.Description")
	assert.Equal(t, expected.Status, actual.Status, "task.Status")
	assert.Equal(t, expected.StartDate, actual.StartDate, "task.StartDate")
	assert.Equal(t, expected.DueDate, actual.DueDate, "task.DueDate")
	assert.Equal(t, expected.ExpectedDurationMinutes, actual.ExpectedDurationMinutes, "task.ExpectedDurationMinutes")
	assert.Equal(t, expected.Position, actual.Position, "task.Position")
	assert.True(t, expected.CreatedAt.UTC().Equal(actual.CreatedAt.UTC()), "task.CreatedAt")
	assert.True(t, expected.UpdatedAt.UTC().Equal(actual.UpdatedAt.UTC()), "task.UpdatedAt")
	if expected.CompletedAt != nil && actual.CompletedAt != nil {
		assert.True(t, expected.CompletedAt.UTC().Equal(actual.CompletedAt.UTC()), "task.CompletedAt")
	} else if expected.CompletedAt != nil || actual.CompletedAt != nil {
		assert.Failf(t, "task.CompletedAt", "either is nil %v, %v", expected.CompletedAt, actual.CompletedAt)
	}
}

func countNotifications(
	t *testing.T,
	svc notificationService.NotificationService,
	userID uuid.UUID,
	objectType string,
	objectID uuid.UUID,
	message string,
) int {
	t.Helper()

	notifications, err := svc.GetNotifications(t.Context(), userID)
	require.NoError(t, err)

	count := 0
	for _, notification := range notifications {
		if notification.ObjectType == objectType &&
			notification.ObjectID == objectID &&
			notification.Message == message {
			count++
		}
	}

	return count
}

func requireNotificationDelta(
	t *testing.T,
	svc notificationService.NotificationService,
	userID uuid.UUID,
	objectType string,
	objectID uuid.UUID,
	message string,
	before int,
	delta int,
) {
	t.Helper()

	after := countNotifications(t, svc, userID, objectType, objectID, message)
	require.Equal(t, before+delta, after)
}

func createNotificationTaskFixture(t *testing.T, db *gorm.DB, sut taskRouteHandler) (models.Project, models.Task, models.ProjectMember, models.ProjectMember) {
	t.Helper()

	users := testutils.SelectRandomUsers(t, db, 2)
	projectName := "Notification Project " + uuid.NewString()
	projectSlug := "notification-project-" + uuid.NewString()
	project, err := sut.projectService.CreateProject(t.Context(), &users[0].ID, projectName, projectSlug, nil, "active")
	require.NoError(t, err)

	addedMembers, err := sut.projectService.AddUsersToProject(
		t.Context(),
		[]projectService.AddMemberRequest{{UserId: users[1].ID, Role: "developer"}},
		project.ID,
	)
	require.NoError(t, err)
	require.Len(t, addedMembers, 1)

	members, err := sut.projectService.GetProjectMembers(t.Context(), project.ID)
	require.NoError(t, err)

	var actorMember models.ProjectMember
	var targetMember models.ProjectMember
	for _, member := range members {
		switch member.UserID {
		case users[0].ID:
			actorMember = member
		case users[1].ID:
			targetMember = member
		}
	}
	require.NotEqual(t, uuid.Nil, actorMember.ID)
	require.NotEqual(t, uuid.Nil, targetMember.ID)

	task := models.Task{
		ProjectID: project.ID,
		CreatedBy: actorMember.ID,
		Title:     "Notification Task " + uuid.NewString(),
		Status:    "todo",
		Position:  0,
	}
	require.NoError(t, sut.taskService.CreateTask(t.Context(), &task))

	createdTask, err := sut.taskService.GetTask(t.Context(), task.ID)
	require.NoError(t, err)

	return *project, *createdTask, actorMember, targetMember
}

func assignTaskForNotificationTest(t *testing.T, sut taskRouteHandler, taskID uuid.UUID, projectMemberID uuid.UUID) {
	t.Helper()

	require.NoError(t, sut.taskService.UnassignTask(t.Context(), taskID, projectMemberID))
	_, err := sut.taskService.AssignTask(t.Context(), taskID, projectMemberID)
	require.NoError(t, err)
}

func TestTaskHandler(t *testing.T) {
	t.Setenv("SESSION_SECRET", "super-secret")

	runTest := func(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, taskRouteHandler)) {
		t.Run(name, func(t *testing.T) {
			_ = db.Transaction(func(tx *gorm.DB) error {
				f(t, tx, newTestTaskHandler(tx, rdb))
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	runTest(t, db, "every member of a project has access to every task in the project", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		randomProject := testutils.SelectRandomProject(t, db)
		usersOfProject := randomProject.Members
		randomUserOfProject := testutils.Choice(&usersOfProject)
		tasksOfProject := randomProject.Tasks

		for _, tsk := range tasksOfProject {
			e := echo.New()
			// test GET
			{
				req := httptest.NewRequest(http.MethodGet, "/tasks/task/", nil)
				rec := httptest.NewRecorder()
				c := e.NewContext(req, rec)
				c.SetPathValues(echo.PathValues{{Name: "id", Value: tsk.ID.String()}})
				loginUser(t, sut.authService, c, randomUserOfProject.User)
				err := sut.authService.AuthenticatedMiddleware()(sut.taskGET)(c)
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, rec.Code)

				resp := parse[routes.Task](t, rec.Body)
				assertEqualTaskResponse(t, tsk, resp)
			}

			// test PATCH
			{
				newTitle := testutils.Faker().BookTitle()
				newDescription := testutils.Faker().ProductDescription()

				taskUpdateFields := map[string]any{
					"title":                     newTitle,
					"description":               newDescription,
					"expected_duration_minutes": nil,
				}

				taskUpdateJson, err := json.Marshal(taskUpdateFields)
				require.NoError(t, err)

				req := httptest.NewRequest(http.MethodPatch, "/tasks/task/", strings.NewReader(string(taskUpdateJson)))
				req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
				rec := httptest.NewRecorder()
				c := e.NewContext(req, rec)
				c.SetPathValues(echo.PathValues{{Name: "id", Value: tsk.ID.String()}})
				loginUser(t, sut.authService, c, randomUserOfProject.User)
				err = sut.authService.AuthenticatedMiddleware()(sut.taskPATCH)(c)
				require.NoError(t, err)
				if !assert.Equal(t, http.StatusOK, rec.Code) {
					t.Fatalf("PATCH /task/task/:id got error response: %s", rec.Body.String())
				}

				resp := parse[routes.Task](t, rec.Body)
				assert.Equal(t, tsk.ID, resp.ID, "task.ID")
				assert.Equal(t, tsk.ProjectID, resp.ProjectID, "task.ProjectID")
				assert.Equal(t, tsk.CreatedBy, resp.CreatedBy, "task.CreatedBy")
				assert.Equal(t, newTitle, resp.Title, "task.Title")
				assert.Equal(t, newDescription, *resp.Description, "task.Description")
				assert.Equal(t, tsk.Status, resp.Status, "task.Status")
				assert.Equal(t, tsk.StartDate, resp.StartDate, "task.StartDate")
				assert.Equal(t, tsk.DueDate, resp.DueDate, "task.DueDate")
				assert.Nil(t, resp.ExpectedDurationMinutes, "task.ExpectedDurationMinutes")
				assert.Equal(t, tsk.Position, resp.Position, "task.Position")
				testutils.RequireEqualTime(t, tsk.CreatedAt, resp.CreatedAt, "task.CreatedAt")
				assert.Greater(t, resp.UpdatedAt, tsk.UpdatedAt, "task.UpdatedAt")
				testutils.RequireEqualDate(t, time.Now(), resp.UpdatedAt, "task.UpdatedAt")

				if tsk.CompletedAt != nil && resp.CompletedAt != nil {
					testutils.RequireEqualTime(t, *tsk.CompletedAt, *resp.CompletedAt, "task.CompletedAt")
				} else if tsk.CompletedAt != nil || resp.CompletedAt != nil {
					assert.Fail(t, "one completedAt is nil while the other is not")
				}
			}

			// test DELETE
			{
				req := httptest.NewRequest(http.MethodDelete, "/tasks/task/", nil)
				rec := httptest.NewRecorder()
				c := e.NewContext(req, rec)
				c.SetPathValues(echo.PathValues{{Name: "id", Value: tsk.ID.String()}})
				loginUser(t, sut.authService, c, randomUserOfProject.User)
				err := sut.authService.AuthenticatedMiddleware()(sut.taskDELETE)(c)
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, rec.Code)

				_, err = sut.taskService.GetTask(t.Context(), tsk.ID)
				require.Error(t, err)
			}
		}
	})

	runTest(t, db, "task assignment and unassignment", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		// unassign -> assign -> unassign should always work
		randomProject := testutils.SelectRandomProject(t, db)
		usersOfProject := randomProject.Members
		randomUserOfProject := testutils.Choice(&usersOfProject)
		tasksOfProject := randomProject.Tasks

		userRequest := map[string]any{
			"project_member_id": randomUserOfProject.ID,
		}
		userRequestJson, err := json.Marshal(userRequest)
		require.NoError(t, err)

		mapTaskID := func(atask models.TaskAssignee) uuid.UUID {
			return atask.TaskID
		}

		for _, tsk := range tasksOfProject {
			e := echo.New()

			// (1) unassign
			{
				req := httptest.NewRequest(http.MethodPost, "/tasks/task/:id/unassign", strings.NewReader(string(userRequestJson)))
				req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
				rec := httptest.NewRecorder()
				c := e.NewContext(req, rec)
				c.SetPathValues(echo.PathValues{{Name: "id", Value: tsk.ID.String()}})
				loginUser(t, sut.authService, c, randomUserOfProject.User)

				err := sut.authService.AuthenticatedMiddleware()(sut.taskUnassignPOST)(c)
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, rec.Code)

				assignedTasks, err := sut.taskService.GetTasksAssignedToProjectMember(t.Context(), randomUserOfProject.ID)
				require.NoError(t, err)

				assignedTaskIDs := testutils.Map(assignedTasks, mapTaskID)
				require.NotContains(t, assignedTaskIDs, tsk.ID)
			}

			// (2) assign
			{
				req := httptest.NewRequest(http.MethodPost, "/tasks/task/:id/assign", strings.NewReader(string(userRequestJson)))
				req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
				rec := httptest.NewRecorder()
				c := e.NewContext(req, rec)
				c.SetPathValues(echo.PathValues{{Name: "id", Value: tsk.ID.String()}})
				loginUser(t, sut.authService, c, randomUserOfProject.User)

				err := sut.authService.AuthenticatedMiddleware()(sut.taskAssignPOST)(c)
				require.NoError(t, err)
				require.Equal(t, http.StatusCreated, rec.Code)
				returnedAssignedTask := parse[routes.TaskAssignee](t, rec.Body)
				require.Equal(t, returnedAssignedTask.TaskID, tsk.ID)
				require.Equal(t, randomUserOfProject.ID, returnedAssignedTask.ProjectMember.ID)
				require.Equal(t, randomUserOfProject.Role, returnedAssignedTask.ProjectMember.Role)
				require.Equal(t, randomUserOfProject.User.ID, returnedAssignedTask.ProjectMember.User.ID)
				require.Equal(t, randomUserOfProject.User.Email, returnedAssignedTask.ProjectMember.User.Email)

				assignedTasks, err := sut.taskService.GetTasksAssignedToProjectMember(t.Context(), randomUserOfProject.ID)
				require.NoError(t, err)

				assignedTaskIDs := testutils.Map(assignedTasks, mapTaskID)
				require.Contains(t, assignedTaskIDs, returnedAssignedTask.TaskID)
			}

			// (3) unassign again
			{
				req := httptest.NewRequest(http.MethodPost, "/tasks/task/:id/unassign", strings.NewReader(string(userRequestJson)))
				req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
				rec := httptest.NewRecorder()
				c := e.NewContext(req, rec)
				c.SetPathValues(echo.PathValues{{Name: "id", Value: tsk.ID.String()}})
				loginUser(t, sut.authService, c, randomUserOfProject.User)

				err := sut.authService.AuthenticatedMiddleware()(sut.taskUnassignPOST)(c)
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, rec.Code)

				assignedTasks, err := sut.taskService.GetTasksAssignedToProjectMember(t.Context(), randomUserOfProject.ID)
				require.NoError(t, err)

				assignedTaskIDs := testutils.Map(assignedTasks, mapTaskID)
				require.NotContains(t, assignedTaskIDs, tsk.ID)
			}
		}
	})

	runTest(t, db, "task assignment changes notify assigned person", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		_, task, actorMember, targetMember := createNotificationTaskFixture(t, db, sut)
		require.NoError(t, sut.taskService.UnassignTask(t.Context(), task.ID, targetMember.ID))

		assignRequest := map[string]any{
			"project_member_id": targetMember.ID,
		}
		assignRequestJSON, err := json.Marshal(assignRequest)
		require.NoError(t, err)

		assignMessage := taskAssignedNotificationMessage(task)
		assignBefore := countNotifications(t, sut.notificationService, targetMember.UserID, "task", task.ID, assignMessage)

		e := echo.New()
		req := httptest.NewRequest(http.MethodPost, "/tasks/task/:id/assign", strings.NewReader(string(assignRequestJSON)))
		req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: task.ID.String()}})
		loginUser(t, sut.authService, c, actorMember.User)

		err = sut.authService.AuthenticatedMiddleware()(sut.taskAssignPOST)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusCreated, rec.Code)
		requireNotificationDelta(t, sut.notificationService, targetMember.UserID, "task", task.ID, assignMessage, assignBefore, 1)

		unassignMessage := taskUnassignedNotificationMessage(task)
		unassignBefore := countNotifications(t, sut.notificationService, targetMember.UserID, "task", task.ID, unassignMessage)

		req = httptest.NewRequest(http.MethodPost, "/tasks/task/:id/unassign", strings.NewReader(string(assignRequestJSON)))
		req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec = httptest.NewRecorder()
		c = e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: task.ID.String()}})
		loginUser(t, sut.authService, c, actorMember.User)

		err = sut.authService.AuthenticatedMiddleware()(sut.taskUnassignPOST)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, rec.Code)
		requireNotificationDelta(t, sut.notificationService, targetMember.UserID, "task", task.ID, unassignMessage, unassignBefore, 1)
	})

	runTest(t, db, "task updates notify assigned people except editor", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		_, task, actorMember, targetMember := createNotificationTaskFixture(t, db, sut)
		assignTaskForNotificationTest(t, sut, task.ID, targetMember.ID)

		newTitle := "Updated Notification Task"
		taskUpdateFields := map[string]any{
			"title": newTitle,
		}
		taskUpdateJSON, err := json.Marshal(taskUpdateFields)
		require.NoError(t, err)

		expectedMessage := taskUpdatedNotificationMessage(models.Task{Title: newTitle})
		before := countNotifications(t, sut.notificationService, targetMember.UserID, "task", task.ID, expectedMessage)

		e := echo.New()
		req := httptest.NewRequest(http.MethodPatch, "/tasks/task/:id", strings.NewReader(string(taskUpdateJSON)))
		req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: task.ID.String()}})
		loginUser(t, sut.authService, c, actorMember.User)

		err = sut.authService.AuthenticatedMiddleware()(sut.taskPATCH)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, rec.Code)
		requireNotificationDelta(t, sut.notificationService, targetMember.UserID, "task", task.ID, expectedMessage, before, 1)
	})

	runTest(t, db, "task status changes notify project members except editor", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		project, task, actorMember, targetMember := createNotificationTaskFixture(t, db, sut)

		taskUpdateFields := map[string]any{
			"status": "in_progress",
		}
		taskUpdateJSON, err := json.Marshal(taskUpdateFields)
		require.NoError(t, err)

		expectedMessage := taskMovedNotificationMessage(models.Task{Title: task.Title, Status: "in_progress"})
		actorBefore := countNotifications(t, sut.notificationService, actorMember.UserID, "task", task.ID, expectedMessage)
		targetBefore := countNotifications(t, sut.notificationService, targetMember.UserID, "task", task.ID, expectedMessage)

		e := echo.New()
		req := httptest.NewRequest(http.MethodPatch, "/tasks/task/:id", strings.NewReader(string(taskUpdateJSON)))
		req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: task.ID.String()}})
		loginUser(t, sut.authService, c, actorMember.User)

		err = sut.authService.AuthenticatedMiddleware()(sut.taskPATCH)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, rec.Code)
		requireNotificationDelta(t, sut.notificationService, actorMember.UserID, "task", task.ID, expectedMessage, actorBefore, 0)
		requireNotificationDelta(t, sut.notificationService, targetMember.UserID, "task", task.ID, expectedMessage, targetBefore, 1)

		for _, projectMember := range project.Members {
			if projectMember.UserID == actorMember.UserID || projectMember.UserID == targetMember.UserID {
				continue
			}

			before := countNotifications(t, sut.notificationService, projectMember.UserID, "task", task.ID, expectedMessage)
			requireNotificationDelta(t, sut.notificationService, projectMember.UserID, "task", task.ID, expectedMessage, before, 0)
		}
	})

	runTest(t, db, "task delete notifies assigned people except deleter", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		project, task, actorMember, targetMember := createNotificationTaskFixture(t, db, sut)
		assignTaskForNotificationTest(t, sut, task.ID, targetMember.ID)

		expectedMessage := taskDeletedNotificationMessage(task)
		before := countNotifications(t, sut.notificationService, targetMember.UserID, "project", project.ID, expectedMessage)

		e := echo.New()
		req := httptest.NewRequest(http.MethodDelete, "/tasks/task/:id", nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: task.ID.String()}})
		loginUser(t, sut.authService, c, actorMember.User)

		err := sut.authService.AuthenticatedMiddleware()(sut.taskDELETE)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, rec.Code)
		requireNotificationDelta(t, sut.notificationService, targetMember.UserID, "project", project.ID, expectedMessage, before, 1)
	})

	runTest(t, db, "task skill changes notify assigned people except editor", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		_, task, actorMember, targetMember := createNotificationTaskFixture(t, db, sut)
		assignTaskForNotificationTest(t, sut, task.ID, targetMember.ID)

		skill, err := sut.projectService.AddProjectSkill(t.Context(), task.ProjectID, "Notification Skill "+uuid.NewString(), nil)
		require.NoError(t, err)

		skillRequest := map[string]any{
			"skillId": skill.ID,
		}
		skillRequestJSON, err := json.Marshal(skillRequest)
		require.NoError(t, err)

		addMessage := taskSkillAddedNotificationMessage(task, skill.Name)
		addBefore := countNotifications(t, sut.notificationService, targetMember.UserID, "task", task.ID, addMessage)

		e := echo.New()
		req := httptest.NewRequest(http.MethodPost, "/tasks/task/:id/add-skill", strings.NewReader(string(skillRequestJSON)))
		req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: task.ID.String()}})
		loginUser(t, sut.authService, c, actorMember.User)

		err = sut.authService.AuthenticatedMiddleware()(sut.taskAddSkill)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, rec.Code)
		requireNotificationDelta(t, sut.notificationService, targetMember.UserID, "task", task.ID, addMessage, addBefore, 1)

		removeMessage := taskSkillRemovedNotificationMessage(task, skill.Name)
		removeBefore := countNotifications(t, sut.notificationService, targetMember.UserID, "task", task.ID, removeMessage)

		req = httptest.NewRequest(http.MethodPost, "/tasks/task/:id/remove-skill", strings.NewReader(string(skillRequestJSON)))
		req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec = httptest.NewRecorder()
		c = e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: task.ID.String()}})
		loginUser(t, sut.authService, c, actorMember.User)

		err = sut.authService.AuthenticatedMiddleware()(sut.taskRemoveSkill)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, rec.Code)
		requireNotificationDelta(t, sut.notificationService, targetMember.UserID, "task", task.ID, removeMessage, removeBefore, 1)
	})

	runTest(t, db, "task position move does not send notification", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		project := testutils.SelectRandomProject(t, db)
		swap := testutils.ChoiceN(project.Tasks, 2)
		from := swap[0]
		to := swap[1]

		member := testutils.Choice(&project.Members)

		moveRequest := map[string]any{
			"position": to.Position,
		}
		moveRequestJson, err := json.Marshal(moveRequest)
		require.NoError(t, err)

		expectedNotificationMessage := taskMovedNotificationMessage(models.Task{
			Status: from.Status,
			Title:  from.Title,
		})
		notificationCountsBefore := make(map[uuid.UUID]int, len(project.Members))
		for _, projectMember := range project.Members {
			notificationCountsBefore[projectMember.UserID] = countNotifications(
				t,
				sut.notificationService,
				projectMember.UserID,
				"task",
				from.ID,
				expectedNotificationMessage,
			)
		}

		e := echo.New()
		req := httptest.NewRequest(http.MethodPost, "/tasks/task/:id/move", strings.NewReader(string(moveRequestJson)))
		req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: from.ID.String()}})
		loginUser(t, sut.authService, c, member.User)

		err = sut.authService.AuthenticatedMiddleware()(sut.taskMovePOST)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, rec.Code)
		returnedMovedTask := parse[routes.Task](t, rec.Body)

		// only check if the task is now actually at the position
		// proper move testing is done in service and db layer
		require.Equal(t, from.ID, returnedMovedTask.ID)
		require.Equal(t, to.Position, returnedMovedTask.Position)

		for _, projectMember := range project.Members {
			requireNotificationDelta(
				t,
				sut.notificationService,
				projectMember.UserID,
				"task",
				from.ID,
				expectedNotificationMessage,
				notificationCountsBefore[projectMember.UserID],
				0,
			)
		}
	})

	runTest(t, db, "tasks assigned to me response should include a task object", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		project := testutils.SelectRandomProject(t, db)
		member := testutils.Choice(&project.Members)

		e := echo.New()
		req := httptest.NewRequest(http.MethodGet, "/tasks/for-project/{id}/my-tasks", nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: project.ID.String()}})
		loginUser(t, sut.authService, c, member.User)
		err := sut.authService.AuthenticatedMiddleware()(sut.tasksForProjectAssignedToMeGET)(c)
		require.NoError(t, err)

		require.Equal(t, http.StatusOK, rec.Code)
		returnedMyTaskAssignments := parse[[]routes.TaskAssigneeWithTask](t, rec.Body)

		myTaskAssignments, err := sut.taskService.GetTasksAssignedToProjectMember(t.Context(), member.ID)
		require.NoError(t, err)

		require.Len(t, returnedMyTaskAssignments, len(myTaskAssignments))

		for _, ret := range returnedMyTaskAssignments {
			i := slices.IndexFunc(myTaskAssignments, func(e models.TaskAssignee) bool {
				return e.ID == ret.ID
			})

			myTaskAssignment := myTaskAssignments[i]

			require.Equal(t, myTaskAssignment.TaskID, ret.TaskID)
			require.Equal(t, myTaskAssignment.ProjectMemberID, ret.ProjectMemberID)
			testutils.RequireEqualTime(t, myTaskAssignment.AssignedAt, ret.AssignedAt)
			assertEqualTaskResponse(t, myTaskAssignment.Task, ret.Task)
		}
	})
}
