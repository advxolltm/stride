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

	projectStore "backend/db/project"
	taskStore "backend/db/task"
	userStore "backend/db/user"
	authService "backend/services/auth"
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

	userService := userService.NewUserService(userStore)
	projectService := projectService.NewProjectService(projectStore)
	authService := authService.NewAuthenticationService(userService)
	taskService := taskService.NewTaskService(taskStore)

	return taskRouteHandler{
		authService,
		taskService,
		projectService,
		rdb,
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
	assert.Equal(t, expected.CreatedAt, actual.CreatedAt, "task.CreatedAt")
	assert.Equal(t, expected.UpdatedAt, actual.UpdatedAt, "task.UpdatedAt")
	assert.Equal(t, expected.CompletedAt, actual.CompletedAt, "task.CompletedAt")
}

func TestAuthHandler(t *testing.T) {
	t.Setenv("SESSION_SECRET", "super-secret")

	runTest := func(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, taskRouteHandler)) {
		t.Run(name, func(t *testing.T) {
			db.Transaction(func(tx *gorm.DB) error {
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
				sut.authService.AuthenticatedMiddleware()(sut.taskGET)(c)
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
				sut.authService.AuthenticatedMiddleware()(sut.taskPATCH)(c)
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
				assert.Equal(t, tsk.CreatedAt, resp.CreatedAt, "task.CreatedAt")
				assert.Greater(t, resp.UpdatedAt, tsk.UpdatedAt, "task.UpdatedAt")
				testutils.RequireEqualDate(t, time.Now(), resp.UpdatedAt, "task.UpdatedAt")
				assert.Equal(t, tsk.CompletedAt, resp.CompletedAt, "task.CompletedAt")
			}

			// test DELETE
			{
				req := httptest.NewRequest(http.MethodDelete, "/tasks/task/", nil)
				rec := httptest.NewRecorder()
				c := e.NewContext(req, rec)
				c.SetPathValues(echo.PathValues{{Name: "id", Value: tsk.ID.String()}})
				loginUser(t, sut.authService, c, randomUserOfProject.User)
				sut.authService.AuthenticatedMiddleware()(sut.taskDELETE)(c)
				require.Equal(t, http.StatusOK, rec.Code)

				_, err := sut.taskService.GetTask(t.Context(), tsk.ID)
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

		userRequest := map[string]any {
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

				sut.authService.AuthenticatedMiddleware()(sut.taskUnassignPOST)(c)
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

				sut.authService.AuthenticatedMiddleware()(sut.taskAssignPOST)(c)
				require.Equal(t, http.StatusCreated, rec.Code)
				returnedAssignedTask := parse[routes.TaskAssignee](t, rec.Body)
				require.Equal(t, returnedAssignedTask.TaskID, tsk.ID)

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

				sut.authService.AuthenticatedMiddleware()(sut.taskUnassignPOST)(c)
				require.Equal(t, http.StatusOK, rec.Code)

				assignedTasks, err := sut.taskService.GetTasksAssignedToProjectMember(t.Context(), randomUserOfProject.ID)
				require.NoError(t, err)

				assignedTaskIDs := testutils.Map(assignedTasks, mapTaskID)
				require.NotContains(t, assignedTaskIDs, tsk.ID)
			}
		}
	})

	runTest(t, db, "task move", func(t *testing.T, db *gorm.DB, sut taskRouteHandler) {
		project := testutils.SelectRandomProject(t, db)
		swap := testutils.ChoiceN(project.Tasks, 2)
		from := swap[0]
		to := swap[1]

		member := testutils.Choice(&project.Members)

		moveRequest := map[string]any {
			"position": to.Position,
		}
		moveRequestJson, err := json.Marshal(moveRequest)
		require.NoError(t, err)

		e := echo.New()
		req := httptest.NewRequest(http.MethodPost, "/tasks/task/:id/move", strings.NewReader(string(moveRequestJson)))
		req.Header.Add(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: from.ID.String()}})
		loginUser(t, sut.authService, c, member.User)

		sut.authService.AuthenticatedMiddleware()(sut.taskMovePOST)(c)
		require.Equal(t, http.StatusOK, rec.Code)
		returnedMovedTasks := parse[[]routes.Task](t, rec.Body)

		// only check if the task is now actually at the position
		// proper move testing is done in service and db layer
		for _, tsk := range returnedMovedTasks {
			if tsk.ID == from.ID {
				require.Equal(t, tsk.Position, to.Position)
			}	
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
		sut.authService.AuthenticatedMiddleware()(sut.tasksForProjectAssignedToMeGET)(c)

		require.Equal(t, http.StatusOK, rec.Code)
		returnedMyTaskAssignments := parse[[]routes.TaskAssigneeWithTask](t, rec.Body)

		myTaskAssignments, err := sut.taskService.GetTasksAssignedToProjectMember(t.Context(), member.UserID)
		require.NoError(t, err)

		require.Len(t, returnedMyTaskAssignments, len(myTaskAssignments))

		for _, ret := range returnedMyTaskAssignments {
			i := slices.IndexFunc(myTaskAssignments, func(e models.TaskAssignee) bool {
				return e.ID == ret.ID
			})

			myTaskAssignment := myTaskAssignments[i]

			require.Equal(t, myTaskAssignment.TaskID, ret.TaskID)
			require.Equal(t, myTaskAssignment.ProjectMemberID, ret.ProjectMemberID)
			require.Equal(t, myTaskAssignment.AssignedAt, ret.AssignedAt)
			assertEqualTaskResponse(t, myTaskAssignment.Task, ret.Task)
		}
	})
}
