package websocket

import (
	appdb "backend/db"
	projectStore "backend/db/project"
	userStore "backend/db/user"
	"backend/routes"
	authService "backend/services/auth"
	projectService "backend/services/project"
	userService "backend/services/user"
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

type wsMetaEnvelope struct {
	Type routes.WSMessageType `json:"type"`
	Meta struct {
		ProjectID    string `json:"projectId"`
		OriginUserID string `json:"originUserId"`
		ClientID     string `json:"clientId"`
		OperationID  string `json:"operationId"`
		SentAt       string `json:"sentAt"`
	} `json:"meta"`
	Payload struct {
		ElementID   string          `json:"elementId"`
		ElementType string          `json:"elementType"`
		Props       json.RawMessage `json:"props"`
		ZIndex      int             `json:"zIndex"`
	} `json:"payload"`
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

		taskMessage := `{"type":1,"payload":{"id":"` + uuid.NewString() + `"}}`
		whiteboardMessage := `{"type":13,"payload":{"id":"` + uuid.NewString() + `"}}`

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

	runTest(t, "republishes valid live update messages with server meta", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "ws-owner-3", "ws-owner-3@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WS Project 3", "ws-project-3-"+uuid.NewString(), nil, "active")
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

		clientMessage := map[string]any{
			"type": routes.WhiteboardElementLiveUpdate,
			"meta": map[string]any{
				"clientId":    "client-123",
				"operationId": "operation-456",
			},
			"payload": map[string]any{
				"elementId":   "element-789",
				"elementType": "rectangle",
				"props": map[string]any{
					"id":   "element-789",
					"type": "rectangle",
				},
				"zIndex": 7,
			},
		}

		err = conn.WriteJSON(clientMessage)
		require.NoError(t, err)

		err = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		require.NoError(t, err)
		_, message, err := conn.ReadMessage()
		require.NoError(t, err)

		var envelope wsMetaEnvelope
		err = json.Unmarshal(message, &envelope)
		require.NoError(t, err)

		assert.Equal(t, routes.WhiteboardElementLiveUpdate, envelope.Type)
		assert.Equal(t, project.ID.String(), envelope.Meta.ProjectID)
		assert.Equal(t, user.ID.String(), envelope.Meta.OriginUserID)
		assert.Equal(t, "client-123", envelope.Meta.ClientID)
		assert.Equal(t, "operation-456", envelope.Meta.OperationID)
		assert.NotEmpty(t, envelope.Meta.SentAt)
		assert.Equal(t, "element-789", envelope.Payload.ElementID)
		assert.Equal(t, "rectangle", envelope.Payload.ElementType)
		assert.Equal(t, 7, envelope.Payload.ZIndex)
		assert.JSONEq(t, `{"id":"element-789","type":"rectangle"}`, string(envelope.Payload.Props))
	})

	runTest(t, "ignores invalid non-live client message types", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "ws-owner-4", "ws-owner-4@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WS Project 4", "ws-project-4-"+uuid.NewString(), nil, "active")
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

		err = conn.WriteJSON(map[string]any{
			"type": routes.TaskCreate,
			"payload": map[string]any{
				"id": uuid.NewString(),
			},
		})
		require.NoError(t, err)

		err = conn.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
		require.NoError(t, err)
		_, _, err = conn.ReadMessage()
		require.Error(t, err)
		netErr, ok := err.(interface{ Timeout() bool })
		require.True(t, ok)
		assert.True(t, netErr.Timeout())
	})
}
