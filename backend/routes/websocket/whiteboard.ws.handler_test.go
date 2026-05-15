package websocket

import (
	appdb "backend/db"
	projectStore "backend/db/project"
	userStore "backend/db/user"
	"backend/routes"
	authService "backend/services/auth"
	projectService "backend/services/project"
	userService "backend/services/user"
	whiteboardSvc "backend/services/whiteboard"
	"backend/testutils"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
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

type wsTestDeps struct {
	authService    authService.AuthService
	projectService projectService.ProjectService
	userService    userService.UserService
	handler        whiteboardWSRouteHandler
}

func newWSTestDeps(db *gorm.DB, rdb *redis.Client) wsTestDeps {
	if rdb == nil {
		rdb = appdb.InitRedis(appdb.RedisDSNFromEnv())
	}

	uStore := userStore.NewUserStore(db)
	pStore := projectStore.NewProjectStore(db)

	uServ := userService.NewUserService(uStore)
	pServ := projectService.NewProjectService(pStore)
	aServ := authService.NewAuthenticationService(uServ)

	return wsTestDeps{
		authService:    aServ,
		projectService: pServ,
		userService:    uServ,
		handler:        newWhiteboardWSRouteHandler(aServ, pServ, uServ, rdb),
	}
}

func getCookie(t *testing.T, authServ authService.AuthService, email string, password string) *http.Cookie {
	t.Helper()
	jwt, _, err := authServ.AuthenticateUser(context.Background(), email, password)
	require.NoError(t, err)
	return &http.Cookie{Name: authService.SessionTokenName, Value: string(jwt)}
}

func newTestWSServer(handler whiteboardWSRouteHandler) *httptest.Server {
	e := echo.New()
	api := e.Group("/api")
	wsGroup := api.Group("/ws")
	handler.addRoutes(wsGroup)
	return httptest.NewServer(e)
}

type wsEnvelope struct {
	Type routes.WSMessageType `json:"type"`
}

func cursorPresenceKeyForTest(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:cursor:presence:%s", projectID)
}

func dialWS(t *testing.T, serverURL string, path string, cookie *http.Cookie) (*websocket.Conn, *http.Response, error) {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(serverURL, "http") + path
	header := http.Header{}
	if cookie != nil {
		header.Add("Cookie", cookie.String())
	}

	return websocket.DefaultDialer.Dial(wsURL, header)
}

func TestWhiteboardWSEndpoint(t *testing.T) {
	runTest := func(t *testing.T, name string, f func(*testing.T, *gorm.DB, wsTestDeps)) {
		t.Run(name, func(t *testing.T) {
			t.Setenv("SESSION_SECRET", "super-secret")
			_ = db.Transaction(func(tx *gorm.DB) error {
				f(t, tx, newWSTestDeps(tx, rdb))
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	runTest(t, "filters only whiteboard element events", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "ws-owner", "ws-owner@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WS Project", "ws-project-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newTestWSServer(deps.handler)
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/whiteboard", cookie)
		require.NoError(t, err)
		require.NotNil(t, resp)
		defer func() {
			require.NoError(t, conn.Close())
		}()

		taskMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.TaskCreate, uuid.NewString())
		whiteboardMessage := fmt.Sprintf(`{"type":%d,"payload":{"id":"%s"}}`, routes.WhiteboardElementCreate, uuid.NewString())

		err = rdb.Publish(ctx, project.ID.String(), taskMessage).Err()
		require.NoError(t, err)
		err = rdb.Publish(ctx, project.ID.String(), whiteboardMessage).Err()
		require.NoError(t, err)

		err = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		require.NoError(t, err)
		_, message, err := conn.ReadMessage()
		require.NoError(t, err)

		var envelope wsEnvelope
		err = json.Unmarshal(message, &envelope)
		require.NoError(t, err)
		assert.Equal(t, routes.WhiteboardElementCreate, envelope.Type)

		err = conn.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
		require.NoError(t, err)
		_, _, err = conn.ReadMessage()
		require.Error(t, err)
		netErr, ok := err.(interface{ Timeout() bool })
		require.True(t, ok)
		assert.True(t, netErr.Timeout())
	})

	runTest(t, "rejects websocket connection for non-member", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		owner, err := deps.userService.CreateUser(ctx, "ws-owner-2", "ws-owner-2@test.com", "Password123!")
		require.NoError(t, err)
		outsider, err := deps.userService.CreateUser(ctx, "ws-outsider", "ws-outsider@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &owner.ID, "WS Project 2", "ws-project-2-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newTestWSServer(deps.handler)
		defer server.Close()

		cookie := getCookie(t, deps.authService, outsider.Email, "Password123!")
		conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/whiteboard", cookie)
		require.Error(t, err)
		if conn != nil {
			require.NoError(t, conn.Close())
		}
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	runTest(t, "cursor pong refreshes presence timestamp", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "ws-cursor-owner", "ws-cursor-owner@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WS Cursor Project", "ws-cursor-project-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		key := cursorPresenceKeyForTest(project.ID)
		testutils.RunRedisTestTransaction(t, rdb, []string{key}, func() {
			server := newTestWSServer(deps.handler)
			defer server.Close()

			cookie := getCookie(t, deps.authService, user.Email, "Password123!")
			conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/whiteboard/cursor", cookie)
			require.NoError(t, err)
			require.NotNil(t, resp)
			defer func() {
				require.NoError(t, conn.Close())
			}()

			var connectionID string
			var before time.Time
			require.Eventually(t, func() bool {
				rawRecords, err := rdb.HGetAll(ctx, key).Result()
				if err != nil || len(rawRecords) != 1 {
					return false
				}

				for field, rawRecord := range rawRecords {
					var record whiteboardSvc.CursorPresenceRecord
					if err := json.Unmarshal([]byte(rawRecord), &record); err != nil {
						return false
					}
					if record.ConnectionID != field || record.User.ID != user.ID.String() {
						return false
					}
					connectionID = field
					before = record.UpdatedAt
					return true
				}
				return false
			}, 3*time.Second, 50*time.Millisecond)

			time.Sleep(20 * time.Millisecond)
			err = conn.WriteControl(websocket.PongMessage, nil, time.Now().Add(time.Second))
			require.NoError(t, err)

			require.Eventually(t, func() bool {
				rawRecord, err := rdb.HGet(ctx, key, connectionID).Result()
				if err != nil {
					return false
				}

				var record whiteboardSvc.CursorPresenceRecord
				if err := json.Unmarshal([]byte(rawRecord), &record); err != nil {
					return false
				}

				return record.UpdatedAt.After(before) &&
					record.Cursor.X == nil &&
					record.Cursor.Y == nil
			}, 3*time.Second, 50*time.Millisecond)
		})
	})
}
