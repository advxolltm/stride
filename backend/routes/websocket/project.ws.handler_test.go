package websocket

import (
	"backend/routes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newProjectWSTestHandler(deps wsTestDeps) projectWSRouteHandler {
	return newProjectWSRouteHandler(deps.authService, deps.projectService, rdb, NewProjectHubRegistry(rdb))
}

func newProjectTestWSServer(handler projectWSRouteHandler) *httptest.Server {
	e := echo.New()
	api := e.Group("/api")
	wsGroup := api.Group("/ws")
	handler.addRoutes(wsGroup)
	return httptest.NewServer(e)
}

func readWSEnvelope(t *testing.T, conn *websocket.Conn, timeout time.Duration) wsEnvelope {
	t.Helper()
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(timeout)))
	_, payload, err := conn.ReadMessage()
	require.NoError(t, err)

	var envelope wsEnvelope
	require.NoError(t, json.Unmarshal(payload, &envelope))
	return envelope
}

func assertNoWSMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration) {
	t.Helper()
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(timeout)))
	_, _, err := conn.ReadMessage()
	require.Error(t, err)
	netErr, ok := err.(interface{ Timeout() bool })
	require.True(t, ok)
	assert.True(t, netErr.Timeout())
}

func TestProjectTasksWSEndpoint(t *testing.T) {
	runTest := func(t *testing.T, name string, f func(*testing.T, *gorm.DB, wsTestDeps)) {
		t.Run(name, func(t *testing.T) {
			t.Setenv("SESSION_SECRET", "super-secret")
			_ = db.Transaction(func(tx *gorm.DB) error {
				f(t, tx, newWSTestDeps(tx, rdb))
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	runTest(t, "project member connects to tasks websocket", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		user, err := deps.userService.CreateUser(ctx, "tasks-owner-"+uuid.NewString(), "tasks-owner-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "Tasks WS", "tasks-ws-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/tasks", cookie)
		require.NoError(t, err)
		require.NotNil(t, resp)
		defer func() {
			require.NoError(t, conn.Close())
		}()
		assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
	})

	runTest(t, "rejects tasks websocket for non-member", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		owner, err := deps.userService.CreateUser(ctx, "tasks-owner-"+uuid.NewString(), "tasks-owner-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		outsider, err := deps.userService.CreateUser(ctx, "tasks-outsider-"+uuid.NewString(), "tasks-outsider-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &owner.ID, "Tasks WS Reject", "tasks-ws-reject-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, outsider.Email, "Password123!")
		conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/tasks", cookie)
		require.Error(t, err)
		if conn != nil {
			require.NoError(t, conn.Close())
		}
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	runTest(t, "kanban alias still connects", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		user, err := deps.userService.CreateUser(ctx, "kanban-owner-"+uuid.NewString(), "kanban-owner-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "Kanban Alias", "kanban-alias-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/kanban", cookie)
		require.NoError(t, err)
		require.NotNil(t, resp)
		defer func() {
			require.NoError(t, conn.Close())
		}()
		assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
	})

	runTest(t, "forwards task and project events to tasks websocket", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		user, err := deps.userService.CreateUser(ctx, "tasks-forward-"+uuid.NewString(), "tasks-forward-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "Tasks Forward", "tasks-forward-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, _, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/tasks", cookie)
		require.NoError(t, err)
		defer func() {
			require.NoError(t, conn.Close())
		}()
		waitForSubCount(t, project.ID.String(), 1)

		taskMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.TaskCreate, uuid.NewString())
		projectMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.ProjectSkillAdd, uuid.NewString())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), taskMessage).Err())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), projectMessage).Err())

		assert.Equal(t, routes.TaskCreate, readWSEnvelope(t, conn, 3*time.Second).Type)
		assert.Equal(t, routes.ProjectSkillAdd, readWSEnvelope(t, conn, 3*time.Second).Type)
	})

	runTest(t, "does not forward chat or whiteboard events to tasks websocket", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		user, err := deps.userService.CreateUser(ctx, "tasks-filter-"+uuid.NewString(), "tasks-filter-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "Tasks Filter", "tasks-filter-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, _, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/tasks", cookie)
		require.NoError(t, err)
		defer func() {
			require.NoError(t, conn.Close())
		}()
		waitForSubCount(t, project.ID.String(), 1)

		chatMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.ChatMessageCreate, uuid.NewString())
		whiteboardMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.WhiteboardElementCreate, uuid.NewString())
		taskMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.TaskUpdate, uuid.NewString())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), chatMessage).Err())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), whiteboardMessage).Err())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), taskMessage).Err())

		assert.Equal(t, routes.TaskUpdate, readWSEnvelope(t, conn, 3*time.Second).Type)
		assertNoWSMessage(t, conn, 300*time.Millisecond)
	})
}

func TestProjectChatWSEndpoint(t *testing.T) {
	runTest := func(t *testing.T, name string, f func(*testing.T, *gorm.DB, wsTestDeps)) {
		t.Run(name, func(t *testing.T) {
			t.Setenv("SESSION_SECRET", "super-secret")
			_ = db.Transaction(func(tx *gorm.DB) error {
				f(t, tx, newWSTestDeps(tx, rdb))
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	runTest(t, "project member connects to chat websocket", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		user, err := deps.userService.CreateUser(ctx, "chat-owner-"+uuid.NewString(), "chat-owner-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "Chat WS", "chat-ws-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/chat", cookie)
		require.NoError(t, err)
		require.NotNil(t, resp)
		defer func() {
			require.NoError(t, conn.Close())
		}()
		assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
	})

	runTest(t, "rejects chat websocket for non-member", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		owner, err := deps.userService.CreateUser(ctx, "chat-owner-"+uuid.NewString(), "chat-owner-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		outsider, err := deps.userService.CreateUser(ctx, "chat-outsider-"+uuid.NewString(), "chat-outsider-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &owner.ID, "Chat WS Reject", "chat-ws-reject-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, outsider.Email, "Password123!")
		conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/chat", cookie)
		require.Error(t, err)
		if conn != nil {
			require.NoError(t, conn.Close())
		}
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	runTest(t, "forwards chat and project events to chat websocket", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		user, err := deps.userService.CreateUser(ctx, "chat-forward-"+uuid.NewString(), "chat-forward-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "Chat Forward", "chat-forward-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, _, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/chat", cookie)
		require.NoError(t, err)
		defer func() {
			require.NoError(t, conn.Close())
		}()
		waitForSubCount(t, project.ID.String(), 1)

		chatMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.ChatMessageCreate, uuid.NewString())
		projectMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.ProjectMemberAdd, uuid.NewString())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), chatMessage).Err())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), projectMessage).Err())

		assert.Equal(t, routes.ChatMessageCreate, readWSEnvelope(t, conn, 3*time.Second).Type)
		assert.Equal(t, routes.ProjectMemberAdd, readWSEnvelope(t, conn, 3*time.Second).Type)
	})

	runTest(t, "does not forward task or whiteboard events to chat websocket", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		user, err := deps.userService.CreateUser(ctx, "chat-filter-"+uuid.NewString(), "chat-filter-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "Chat Filter", "chat-filter-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, _, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/chat", cookie)
		require.NoError(t, err)
		defer func() {
			require.NoError(t, conn.Close())
		}()
		waitForSubCount(t, project.ID.String(), 1)

		taskMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.TaskCreate, uuid.NewString())
		whiteboardMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.WhiteboardElementCreate, uuid.NewString())
		chatMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.ChatMessageUpdate, uuid.NewString())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), taskMessage).Err())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), whiteboardMessage).Err())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), chatMessage).Err())

		assert.Equal(t, routes.ChatMessageUpdate, readWSEnvelope(t, conn, 3*time.Second).Type)
		assertNoWSMessage(t, conn, 300*time.Millisecond)
	})

	runTest(t, "messages alias behaves as chat websocket", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := context.Background()
		user, err := deps.userService.CreateUser(ctx, "messages-owner-"+uuid.NewString(), "messages-owner-"+uuid.NewString()+"@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "Messages Alias", "messages-alias-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newProjectTestWSServer(newProjectWSTestHandler(deps))
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, _, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/messages", cookie)
		require.NoError(t, err)
		defer func() {
			require.NoError(t, conn.Close())
		}()
		waitForSubCount(t, project.ID.String(), 1)

		chatMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.ChatMessageDelete, uuid.NewString())
		require.NoError(t, rdb.Publish(ctx, project.ID.String(), chatMessage).Err())

		assert.Equal(t, routes.ChatMessageDelete, readWSEnvelope(t, conn, 3*time.Second).Type)
	})
}
