package projects

import (
	"backend/models"
	"backend/routes"
	"backend/testutils"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	projectStore "backend/db/project"
	userStore "backend/db/user"
	whiteboardStore "backend/db/whiteboard"
	authService "backend/services/auth"
	projectService "backend/services/project"
	userService "backend/services/user"
	whiteboardService "backend/services/whiteboard"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

type whiteboardTestDeps struct {
	handler           *whiteboardRouteHandler
	authService       authService.AuthService
	projectService    projectService.ProjectService
	whiteboardSerivce whiteboardService.WhiteboardService
	userService       userService.UserService
}

func newTestWhiteboardHandler(db *gorm.DB, rdb *redis.Client) whiteboardTestDeps {
	uStore := userStore.NewUserStore(db)
	pStore := projectStore.NewProjectStore(db)
	wStore := whiteboardStore.NewWhiteboardStore(db)

	uServ := userService.NewUserService(uStore)
	pServ := projectService.NewProjectService(pStore)
	aServ := authService.NewAuthenticationService(uServ)
	wServ := whiteboardService.NewWhiteboardService(wStore, pServ, whiteboardStore.NewPendingElementStore(rdb))

	return whiteboardTestDeps{
		handler:           newWhiteboardRouteHandler(wServ, aServ, rdb),
		authService:       aServ,
		projectService:    pServ,
		whiteboardSerivce: wServ,
		userService:       uServ,
	}
}

func loginUser(t *testing.T, aService authService.AuthService, c *echo.Context, user models.User) {
	t.Helper()
	jwtStr, expiry, err := aService.AuthenticateUser(t.Context(), user.Email, "Password123!")
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

type testWSMessage struct {
	Type    routes.WSMessageType  `json:"type"`
	Meta    *routes.WSMessageMeta `json:"meta"`
	Payload json.RawMessage       `json:"payload"`
}

type testDeletePayload struct {
	ElementID uuid.UUID `json:"elementId"`
}

func waitForWSMessage(t *testing.T, ch <-chan *redis.Message) testWSMessage {
	t.Helper()

	select {
	case msg := <-ch:
		var parsed testWSMessage
		err := json.Unmarshal([]byte(msg.Payload), &parsed)
		require.NoError(t, err)
		return parsed
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for ws message")
		return testWSMessage{}
	}
}

func subscribeProjectChannel(t *testing.T, rdb *redis.Client, projectID uuid.UUID) (*redis.PubSub, <-chan *redis.Message) {
	t.Helper()
	sub := rdb.Subscribe(context.Background(), projectID.String())
	_, err := sub.ReceiveTimeout(context.Background(), 3*time.Second)
	require.NoError(t, err)
	return sub, sub.Channel()
}

func TestWhiteboardHandlerPublishesWSEvents(t *testing.T) {
	t.Setenv("SESSION_SECRET", "super-secret")

	runTest := func(t *testing.T, name string, f func(*testing.T, *gorm.DB, whiteboardTestDeps)) {
		t.Run(name, func(t *testing.T) {
			_ = db.Transaction(func(tx *gorm.DB) error {
				f(t, tx, newTestWhiteboardHandler(tx, rdb))
				return fmt.Errorf("rollback %s", t.Name())
			})
		})
	}

	runTest(t, "create publishes whiteboard create event", func(t *testing.T, tx *gorm.DB, deps whiteboardTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "wb-create", "wb-create@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WB Create", "wb-create-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)
		_, err = deps.whiteboardSerivce.GetOrCreateWhiteboardByProjectID(ctx, user.ID, project.ID)
		require.NoError(t, err)

		sub, ch := subscribeProjectChannel(t, rdb, project.ID)
		defer func() {
			require.NoError(t, sub.Close())
		}()

		body := `{"elementType":"rectangle","props":{"id":"shape-1","type":"rectangle"},"zIndex":1}`
		req := httptest.NewRequest(http.MethodPost, "/projects/:id/whiteboard/elements", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		e := echo.New()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: project.ID.String()}})
		loginUser(t, deps.authService, c, *user)

		err = deps.authService.AuthenticatedMiddleware()(deps.handler.elementPOSTHandle)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rec.Code)

		msg := waitForWSMessage(t, ch)
		require.Equal(t, routes.WhiteboardElementCreate, msg.Type)
		require.NotNil(t, msg.Meta)
		assert.Equal(t, project.ID, msg.Meta.ProjectID)
		require.NotNil(t, msg.Meta.OriginUserID)
		assert.Equal(t, user.ID, *msg.Meta.OriginUserID)

		var payload whiteboardElementWSUpdate
		err = json.Unmarshal(msg.Payload, &payload)
		require.NoError(t, err)
		assert.Equal(t, "rectangle", payload.ElementType)
		assert.Equal(t, 1, payload.ZIndex)
		assert.Equal(t, &user.ID, payload.CreatedBy)

		assertPendingOpPresent(t, rdb, project.ID, payload.ID)
		var dbEl models.WhiteboardElement
		err = tx.First(&dbEl, "id = ?", payload.ID).Error
		require.ErrorIs(t, err, gorm.ErrRecordNotFound)
		cleanupPendingKeys(t, rdb, project.ID)
	})

	runTest(t, "update publishes whiteboard update event", func(t *testing.T, tx *gorm.DB, deps whiteboardTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "wb-update", "wb-update@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WB Update", "wb-update-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)
		wb, err := deps.whiteboardSerivce.GetOrCreateWhiteboardByProjectID(ctx, user.ID, project.ID)
		require.NoError(t, err)

		element := &models.WhiteboardElement{
			WhiteboardID: wb.ID,
			CreatedBy:    &user.ID,
			ElementType:  "ellipse",
			Props:        datatypes.JSON([]byte(`{"id":"shape-2","type":"ellipse"}`)),
			ZIndex:       2,
		}
		created, err := deps.whiteboardSerivce.CreateElement(ctx, user.ID, project.ID, element)
		require.NoError(t, err)

		sub, ch := subscribeProjectChannel(t, rdb, project.ID)
		defer func() {
			require.NoError(t, sub.Close())
		}()

		body := `{"elementType":"diamond","props":{"id":"shape-2","type":"diamond"},"zIndex":4}`
		req := httptest.NewRequest(http.MethodPatch, "/projects/:id/whiteboard/elements/:elementId", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		e := echo.New()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{
			{Name: "id", Value: project.ID.String()},
			{Name: "elementId", Value: created.ID.String()},
		})
		loginUser(t, deps.authService, c, *user)

		err = deps.authService.AuthenticatedMiddleware()(deps.handler.elementPATCHHandle)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rec.Code)

		msg := waitForWSMessage(t, ch)
		require.Equal(t, routes.WhiteboardElementUpdate, msg.Type)

		var payload whiteboardElementWSUpdate
		err = json.Unmarshal(msg.Payload, &payload)
		require.NoError(t, err)
		assert.Equal(t, created.ID, payload.ID)
		assert.Equal(t, "diamond", payload.ElementType)
		assert.Equal(t, 4, payload.ZIndex)

		assertPendingOpPresent(t, rdb, project.ID, created.ID)
		cleanupPendingKeys(t, rdb, project.ID)
	})

	runTest(t, "delete publishes whiteboard delete event", func(t *testing.T, tx *gorm.DB, deps whiteboardTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "wb-delete", "wb-delete@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WB Delete", "wb-delete-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)
		wb, err := deps.whiteboardSerivce.GetOrCreateWhiteboardByProjectID(ctx, user.ID, project.ID)
		require.NoError(t, err)

		element := &models.WhiteboardElement{
			WhiteboardID: wb.ID,
			CreatedBy:    &user.ID,
			ElementType:  "ellipse",
			Props:        datatypes.JSON([]byte(`{"id":"shape-3","type":"ellipse"}`)),
			ZIndex:       3,
		}
		created, err := deps.whiteboardSerivce.CreateElement(ctx, user.ID, project.ID, element)
		require.NoError(t, err)

		sub, ch := subscribeProjectChannel(t, rdb, project.ID)
		defer func() {
			require.NoError(t, sub.Close())
		}()

		req := httptest.NewRequest(http.MethodDelete, "/projects/:id/whiteboard/elements/:elementId", nil)
		rec := httptest.NewRecorder()
		e := echo.New()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{
			{Name: "id", Value: project.ID.String()},
			{Name: "elementId", Value: created.ID.String()},
		})
		loginUser(t, deps.authService, c, *user)

		err = deps.authService.AuthenticatedMiddleware()(deps.handler.elementDELETEHandle)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rec.Code)

		msg := waitForWSMessage(t, ch)
		require.Equal(t, routes.WhiteboardElementDelete, msg.Type)

		var payload testDeletePayload
		err = json.Unmarshal(msg.Payload, &payload)
		require.NoError(t, err)
		assert.Equal(t, created.ID, payload.ElementID)

		// Buffered delete: pending op present, DB row still present (until flush).
		assertPendingOpPresent(t, rdb, project.ID, created.ID)
		var stillThere models.WhiteboardElement
		require.NoError(t, tx.First(&stillThere, "id = ?", created.ID).Error)
		cleanupPendingKeys(t, rdb, project.ID)
	})

	runTest(t, "update after pending delete is a true no-op", func(t *testing.T, tx *gorm.DB, deps whiteboardTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "wb-update-after-delete", "wb-update-after-delete@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WB Update After Delete", "wb-update-after-delete-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)
		wb, err := deps.whiteboardSerivce.GetOrCreateWhiteboardByProjectID(ctx, user.ID, project.ID)
		require.NoError(t, err)

		element := &models.WhiteboardElement{
			WhiteboardID: wb.ID,
			CreatedBy:    &user.ID,
			ElementType:  "rectangle",
			Props:        datatypes.JSON([]byte(`{"id":"shape-noop","type":"rectangle"}`)),
			ZIndex:       6,
		}
		created, err := deps.whiteboardSerivce.CreateElement(ctx, user.ID, project.ID, element)
		require.NoError(t, err)

		pendingStore := whiteboardStore.NewPendingElementStore(rdb)
		require.NoError(t, pendingStore.PutPendingElementOperation(ctx, whiteboardStore.PendingElementOperation{
			ProjectID:    project.ID,
			ElementID:    created.ID,
			WhiteboardID: wb.ID,
			Operation:    whiteboardStore.PendingElementDelete,
			UpdatedAt:    time.Now().UTC(),
		}))
		require.NoError(t, pendingStore.MarkProjectPendingFlush(ctx, project.ID, time.Now().UTC()))
		t.Cleanup(func() { cleanupPendingKeys(t, rdb, project.ID) })

		sub, ch := subscribeProjectChannel(t, rdb, project.ID)
		defer func() {
			require.NoError(t, sub.Close())
		}()

		body := `{"elementType":"diamond","props":{"id":"shape-noop","type":"diamond"},"zIndex":9}`
		req := httptest.NewRequest(http.MethodPatch, "/projects/:id/whiteboard/elements/:elementId", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		e := echo.New()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{
			{Name: "id", Value: project.ID.String()},
			{Name: "elementId", Value: created.ID.String()},
		})
		loginUser(t, deps.authService, c, *user)

		err = deps.authService.AuthenticatedMiddleware()(deps.handler.elementPATCHHandle)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rec.Code)
		assert.Empty(t, rec.Body.String(), "no-op update should not return payload")

		select {
		case msg := <-ch:
			t.Fatalf("expected no ws message for update folded onto delete, got %s", msg.Payload)
		case <-time.After(500 * time.Millisecond):
		}

		raw, err := rdb.HGet(ctx, fmt.Sprintf("whiteboard:pending:%s:elements", project.ID), created.ID.String()).Result()
		require.NoError(t, err)
		var op whiteboardStore.PendingElementOperation
		require.NoError(t, json.Unmarshal([]byte(raw), &op))
		assert.Equal(t, whiteboardStore.PendingElementDelete, op.Operation)
		assert.Equal(t, wb.ID, op.WhiteboardID)
	})

	runTest(t, "create then delete collapses and still publishes delete", func(t *testing.T, tx *gorm.DB, deps whiteboardTestDeps) {
		ctx := t.Context()
		user, err := deps.userService.CreateUser(ctx, "wb-collapse", "wb-collapse@test.com", "Password123!")
		require.NoError(t, err)
		project, err := deps.projectService.CreateProject(ctx, &user.ID, "WB Collapse", "wb-collapse-"+uuid.NewString(), nil, "active")
		require.NoError(t, err)
		_, err = deps.whiteboardSerivce.GetOrCreateWhiteboardByProjectID(ctx, user.ID, project.ID)
		require.NoError(t, err)

		sub, ch := subscribeProjectChannel(t, rdb, project.ID)
		defer func() {
			require.NoError(t, sub.Close())
		}()

		// Step 1: POST create (buffered).
		body := `{"elementType":"rectangle","props":{"id":"shape-x","type":"rectangle"},"zIndex":1}`
		req := httptest.NewRequest(http.MethodPost, "/projects/:id/whiteboard/elements", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		e := echo.New()
		c := e.NewContext(req, rec)
		c.SetPathValues(echo.PathValues{{Name: "id", Value: project.ID.String()}})
		loginUser(t, deps.authService, c, *user)

		err = deps.authService.AuthenticatedMiddleware()(deps.handler.elementPOSTHandle)(c)
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rec.Code)

		// Consume the optimistic create event.
		createMsg := waitForWSMessage(t, ch)
		require.Equal(t, routes.WhiteboardElementCreate, createMsg.Type)
		var createdPayload whiteboardElementWSUpdate
		require.NoError(t, json.Unmarshal(createMsg.Payload, &createdPayload))
		elementID := createdPayload.ID

		assertPendingOpPresent(t, rdb, project.ID, elementID)
		t.Cleanup(func() { cleanupPendingKeys(t, rdb, project.ID) })

		// Step 2: DELETE the same element -> should collapse.
		delReq := httptest.NewRequest(http.MethodDelete, "/projects/:id/whiteboard/elements/:elementId", nil)
		delRec := httptest.NewRecorder()
		delCtx := e.NewContext(delReq, delRec)
		delCtx.SetPathValues(echo.PathValues{
			{Name: "id", Value: project.ID.String()},
			{Name: "elementId", Value: elementID.String()},
		})
		loginUser(t, deps.authService, delCtx, *user)

		err = deps.authService.AuthenticatedMiddleware()(deps.handler.elementDELETEHandle)(delCtx)
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, delRec.Code)

		deleteMsg := waitForWSMessage(t, ch)
		require.Equal(t, routes.WhiteboardElementDelete, deleteMsg.Type)
		var deletedPayload whiteboardElementDeleteWSUpdate
		require.NoError(t, json.Unmarshal(deleteMsg.Payload, &deletedPayload))
		assert.Equal(t, elementID, deletedPayload.ElementID)

		// Pending hash field for this element must be gone.
		exists, err := rdb.HExists(t.Context(), fmt.Sprintf("whiteboard:pending:%s:elements", project.ID), elementID.String()).Result()
		require.NoError(t, err)
		require.False(t, exists, "pending op should be collapsed away")

		// DB must never have seen the element.
		var found models.WhiteboardElement
		err = tx.First(&found, "id = ?", elementID).Error
		require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}

func assertPendingOpPresent(t *testing.T, rdb *redis.Client, projectID, elementID uuid.UUID) {
	t.Helper()
	exists, err := rdb.HExists(t.Context(), fmt.Sprintf("whiteboard:pending:%s:elements", projectID), elementID.String()).Result()
	require.NoError(t, err)
	require.True(t, exists, "expected pending op for element %s", elementID)
}

func cleanupPendingKeys(t *testing.T, rdb *redis.Client, projectID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	rdb.Del(ctx,
		fmt.Sprintf("whiteboard:pending:%s:elements", projectID),
		fmt.Sprintf("whiteboard:pending:%s:flush_at", projectID),
		fmt.Sprintf("whiteboard:pending:%s:first_pending_at", projectID),
	)
	rdb.SRem(ctx, "whiteboard:pending:projects", projectID.String())
}
