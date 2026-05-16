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

	"github.com/golang-jwt/jwt/v5"
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
		handler:        newWhiteboardWSRouteHandler(aServ, pServ, uServ, rdb, NewProjectHubRegistry(rdb)),
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

type wsEnvelopeWithMeta struct {
	Type    routes.WSMessageType `json:"type"`
	Meta    routes.WSMessageMeta `json:"meta"`
	Payload json.RawMessage      `json:"payload"`
}

type testWhiteboardForwardPayload struct {
	ID   uuid.UUID `json:"id"`
	Kind string    `json:"kind,omitempty"`
}

type testJWTClaims struct {
	UserID uuid.UUID `json:"userid"`
	jwt.RegisteredClaims
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

func getCookieWithExpiry(t *testing.T, secret string, userID uuid.UUID, expiry time.Time) *http.Cookie {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, testJWTClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiry),
		},
	})
	signed, err := token.SignedString([]byte(secret))
	require.NoError(t, err)
	return &http.Cookie{Name: authService.SessionTokenName, Value: signed, Expires: expiry}
}

func waitForWSEnvelopeWithMeta(t *testing.T, conn *websocket.Conn, timeout time.Duration) wsEnvelopeWithMeta {
	t.Helper()
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(timeout)))
	_, payload, err := conn.ReadMessage()
	require.NoError(t, err)
	var envelope wsEnvelopeWithMeta
	require.NoError(t, json.Unmarshal(payload, &envelope))
	return envelope
}

func cursorPresenceKeyForTest(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:cursor:presence:%s", projectID)
}

func waitForCursorSnapshot(
	t *testing.T,
	conn *websocket.Conn,
	timeout time.Duration,
	predicate func([]whiteboardSvc.CursorPresence) bool,
	description string,
) []whiteboardSvc.CursorPresence {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			t.Fatalf("timeout waiting for cursor snapshot: %s", description)
		}
		require.NoError(t, conn.SetReadDeadline(time.Now().Add(remaining)))
		_, payload, err := conn.ReadMessage()
		require.NoError(t, err)

		var snapshot []whiteboardSvc.CursorPresence
		require.NoError(t, json.Unmarshal(payload, &snapshot))
		if predicate(snapshot) {
			return snapshot
		}
	}
}

func cursorPresenceByUser(snapshot []whiteboardSvc.CursorPresence, userID string) *whiteboardSvc.CursorPresence {
	for i := range snapshot {
		if snapshot[i].User.ID == userID {
			return &snapshot[i]
		}
	}
	return nil
}

func addProjectMember(t *testing.T, deps wsTestDeps, projectID, userID uuid.UUID) {
	t.Helper()
	_, err := deps.projectService.AddUsersToProject(t.Context(), []projectService.AddMemberRequest{{
		UserId: userID,
		Role:   "member",
	}}, projectID)
	require.NoError(t, err)
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

	runTest(t, "forwards rollback events", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "ws-rollback", "ws-rollback@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WS Rollback", "ws-rollback-"+uuid.NewString(), nil, "active")
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

		rollbackMeta := &routes.WSMessageMeta{OriginUserID: &user.ID, ClientID: "rollback-client", OperationID: "rollback-op"}
		rollbackPayload := routes.WhiteboardElementRollbackPayload{
			ProjectID:   project.ID,
			ElementID:   uuid.New(),
			OperationID: "rollback-op",
			Reason:      "boom",
		}
		require.NoError(t, routes.SendWSUpdateWithMeta(ctx, rdb, project.ID, routes.WhiteboardElementRollback, rollbackMeta, rollbackPayload))

		envelope := waitForWSEnvelopeWithMeta(t, conn, 3*time.Second)
		assert.Equal(t, routes.WhiteboardElementRollback, envelope.Type)
		assert.Equal(t, rollbackMeta.ClientID, envelope.Meta.ClientID)
		assert.Equal(t, rollbackMeta.OperationID, envelope.Meta.OperationID)
		require.NotNil(t, envelope.Meta.OriginUserID)
		assert.Equal(t, user.ID, *envelope.Meta.OriginUserID)

		var payload routes.WhiteboardElementRollbackPayload
		require.NoError(t, json.Unmarshal(envelope.Payload, &payload))
		assert.Equal(t, rollbackPayload.ProjectID, payload.ProjectID)
		assert.Equal(t, rollbackPayload.ElementID, payload.ElementID)
		assert.Equal(t, rollbackPayload.OperationID, payload.OperationID)
		assert.Equal(t, rollbackPayload.Reason, payload.Reason)
	})

	runTest(t, "ignores malformed pubsub payload and stays alive", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "ws-malformed", "ws-malformed@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WS Malformed", "ws-malformed-"+uuid.NewString(), nil, "active")
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

		require.NoError(t, rdb.Publish(ctx, project.ID.String(), "{not-json").Err())
		createMeta := &routes.WSMessageMeta{OriginUserID: &user.ID, ClientID: "valid-client", OperationID: "valid-op"}
		createPayload := testWhiteboardForwardPayload{ID: uuid.New(), Kind: "valid-after-malformed"}
		require.NoError(t, routes.SendWSUpdateWithMeta(ctx, rdb, project.ID, routes.WhiteboardElementCreate, createMeta, createPayload))

		envelope := waitForWSEnvelopeWithMeta(t, conn, 3*time.Second)
		assert.Equal(t, routes.WhiteboardElementCreate, envelope.Type)
		assert.Equal(t, createMeta.ClientID, envelope.Meta.ClientID)
		assert.Equal(t, createMeta.OperationID, envelope.Meta.OperationID)
	})

	runTest(t, "cursor websocket sends initial snapshot on connect", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "ws-cursor-init", "ws-cursor-init@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WS Cursor Init", "ws-cursor-init-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newTestWSServer(deps.handler)
		defer server.Close()

		cookie := getCookie(t, deps.authService, user.Email, "Password123!")
		conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/whiteboard/cursor", cookie)
		require.NoError(t, err)
		require.NotNil(t, resp)
		defer func() {
			require.NoError(t, conn.Close())
		}()

		snapshot := waitForCursorSnapshot(t, conn, 3*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
			return len(snapshot) == 1 && cursorPresenceByUser(snapshot, user.ID.String()) != nil
		}, "initial self snapshot")

		presence := cursorPresenceByUser(snapshot, user.ID.String())
		require.NotNil(t, presence)
		assert.Equal(t, user.Username, presence.User.Name)
		assert.Nil(t, presence.Cursor.X)
		assert.Nil(t, presence.Cursor.Y)
	})

	runTest(t, "cursor update rebroadcasts to other clients", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		owner, err := deps.userService.CreateUser(ctx, "ws-cursor-owner", "ws-cursor-owner@test.com", "Password123!")
		require.NoError(t, err)
		other, err := deps.userService.CreateUser(ctx, "ws-cursor-peer", "ws-cursor-peer@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &owner.ID, "WS Cursor Broadcast", "ws-cursor-broadcast-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)
		addProjectMember(t, deps, project.ID, other.ID)

		server := newTestWSServer(deps.handler)
		defer server.Close()

		ownerConn, ownerResp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/whiteboard/cursor", getCookie(t, deps.authService, owner.Email, "Password123!"))
		require.NoError(t, err)
		require.NotNil(t, ownerResp)
		defer func() {
			require.NoError(t, ownerConn.Close())
		}()
		_ = waitForCursorSnapshot(t, ownerConn, 3*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
			return len(snapshot) == 1 && cursorPresenceByUser(snapshot, owner.ID.String()) != nil
		}, "owner initial snapshot")

		otherConn, otherResp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/whiteboard/cursor", getCookie(t, deps.authService, other.Email, "Password123!"))
		require.NoError(t, err)
		require.NotNil(t, otherResp)
		defer func() {
			require.NoError(t, otherConn.Close())
		}()

		_ = waitForCursorSnapshot(t, ownerConn, 3*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
			return len(snapshot) == 2 && cursorPresenceByUser(snapshot, owner.ID.String()) != nil && cursorPresenceByUser(snapshot, other.ID.String()) != nil
		}, "owner sees both users")
		_ = waitForCursorSnapshot(t, otherConn, 3*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
			return len(snapshot) == 2 && cursorPresenceByUser(snapshot, owner.ID.String()) != nil && cursorPresenceByUser(snapshot, other.ID.String()) != nil
		}, "peer sees both users")

		x, y := 12.5, 34.5
		require.NoError(t, ownerConn.WriteJSON(whiteboardSvc.CursorClientMessage{
			Cursor: whiteboardSvc.CursorPosition{X: &x, Y: &y},
		}))

		snapshot := waitForCursorSnapshot(t, otherConn, 3*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
			presence := cursorPresenceByUser(snapshot, owner.ID.String())
			return presence != nil && presence.Cursor.X != nil && presence.Cursor.Y != nil && *presence.Cursor.X == x && *presence.Cursor.Y == y
		}, "peer receives owner cursor update")

		presence := cursorPresenceByUser(snapshot, owner.ID.String())
		require.NotNil(t, presence)
		require.NotNil(t, presence.Cursor.X)
		require.NotNil(t, presence.Cursor.Y)
		assert.Equal(t, x, *presence.Cursor.X)
		assert.Equal(t, y, *presence.Cursor.Y)

		key := cursorPresenceKeyForTest(project.ID)
		require.Eventually(t, func() bool {
			rawRecords, err := rdb.HGetAll(ctx, key).Result()
			if err != nil {
				return false
			}
			for _, raw := range rawRecords {
				var record whiteboardSvc.CursorPresenceRecord
				if json.Unmarshal([]byte(raw), &record) != nil {
					return false
				}
				if record.User.ID == owner.ID.String() && record.Cursor.X != nil && record.Cursor.Y != nil {
					return *record.Cursor.X == x && *record.Cursor.Y == y
				}
			}
			return false
		}, 3*time.Second, 50*time.Millisecond)
	})

	runTest(t, "cursor disconnect removes presence and republishes snapshot", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		owner, err := deps.userService.CreateUser(ctx, "ws-cursor-disc-owner", "ws-cursor-disc-owner@test.com", "Password123!")
		require.NoError(t, err)
		other, err := deps.userService.CreateUser(ctx, "ws-cursor-disc-peer", "ws-cursor-disc-peer@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &owner.ID, "WS Cursor Disconnect", "ws-cursor-disconnect-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)
		addProjectMember(t, deps, project.ID, other.ID)

		server := newTestWSServer(deps.handler)
		defer server.Close()

		ownerConn, ownerResp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/whiteboard/cursor", getCookie(t, deps.authService, owner.Email, "Password123!"))
		require.NoError(t, err)
		require.NotNil(t, ownerResp)
		defer func() { _ = ownerConn.Close() }()
		_ = waitForCursorSnapshot(t, ownerConn, 3*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
			return len(snapshot) == 1 && cursorPresenceByUser(snapshot, owner.ID.String()) != nil
		}, "owner initial snapshot")

		otherConn, otherResp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/whiteboard/cursor", getCookie(t, deps.authService, other.Email, "Password123!"))
		require.NoError(t, err)
		require.NotNil(t, otherResp)
		defer func() {
			require.NoError(t, otherConn.Close())
		}()

		_ = waitForCursorSnapshot(t, ownerConn, 3*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
			return len(snapshot) == 2 && cursorPresenceByUser(snapshot, owner.ID.String()) != nil && cursorPresenceByUser(snapshot, other.ID.String()) != nil
		}, "owner sees both users")
		_ = waitForCursorSnapshot(t, otherConn, 3*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
			return len(snapshot) == 2 && cursorPresenceByUser(snapshot, owner.ID.String()) != nil && cursorPresenceByUser(snapshot, other.ID.String()) != nil
		}, "peer sees both users")

		require.NoError(t, ownerConn.Close())

		snapshot := waitForCursorSnapshot(t, otherConn, 3*time.Second, func(snapshot []whiteboardSvc.CursorPresence) bool {
			return len(snapshot) == 1 && cursorPresenceByUser(snapshot, other.ID.String()) != nil && cursorPresenceByUser(snapshot, owner.ID.String()) == nil
		}, "peer sees owner removed after disconnect")

		assert.Nil(t, cursorPresenceByUser(snapshot, owner.ID.String()))
		require.NotNil(t, cursorPresenceByUser(snapshot, other.ID.String()))

		key := cursorPresenceKeyForTest(project.ID)
		require.Eventually(t, func() bool {
			rawRecords, err := rdb.HGetAll(ctx, key).Result()
			if err != nil || len(rawRecords) != 1 {
				return false
			}
			for _, raw := range rawRecords {
				var record whiteboardSvc.CursorPresenceRecord
				if json.Unmarshal([]byte(raw), &record) != nil {
					return false
				}
				return record.User.ID == other.ID.String()
			}
			return false
		}, 3*time.Second, 50*time.Millisecond)
	})

	runTest(t, "expired session stops whiteboard forwarding", func(t *testing.T, tx *gorm.DB, deps wsTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "ws-expiry", "ws-expiry@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WS Expiry", "ws-expiry-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)

		server := newTestWSServer(deps.handler)
		defer server.Close()

		expiry := time.Now().Add(1 * time.Second)
		cookie := getCookieWithExpiry(t, "super-secret", user.ID, expiry)
		conn, resp, err := dialWS(t, server.URL, "/api/ws/project/"+project.ID.String()+"/whiteboard", cookie)
		require.NoError(t, err)
		require.NotNil(t, resp)
		defer func() { _ = conn.Close() }()

		time.Sleep(time.Until(expiry.Add(150 * time.Millisecond)))
		meta := &routes.WSMessageMeta{OriginUserID: &user.ID, ClientID: "expired-client", OperationID: "expired-op"}
		payload := testWhiteboardForwardPayload{ID: uuid.New()}
		require.NoError(t, routes.SendWSUpdateWithMeta(ctx, rdb, project.ID, routes.WhiteboardElementCreate, meta, payload))

		require.NoError(t, conn.SetReadDeadline(time.Now().Add(3*time.Second)))
		_, _, err = conn.ReadMessage()
		require.Error(t, err)
		assert.NotContains(t, err.Error(), `"type":`, "expired session must not forward whiteboard payloads")
	})

}
