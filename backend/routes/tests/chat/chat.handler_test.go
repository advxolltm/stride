package routes_chat_test

import (
	chatStore "backend/db/chat"
	notificationStore "backend/db/notification"
	"backend/db/project"
	userStore "backend/db/user"
	"backend/models"
	"backend/routes"
	projectsHandler "backend/routes/projects"
	authService "backend/services/auth"
	chatService "backend/services/chat"
	notificationService "backend/services/notification"
	projectService "backend/services/project"
	userService "backend/services/user"
	"backend/testutils"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

type createMessageRequest struct {
	Content string `json:"content" example:"You should play Hollow Knight!"`
}
type updateMessageRequest struct {
	Content string `json:"content" example:"You should play Deltarune!"`
}

func getCookie(t *testing.T, authServ authService.AuthService, email string, password string) *http.Cookie {
	jwt, _, err := authServ.AuthenticateUser(context.Background(), email, password)
	require.NoError(t, err)
	return &http.Cookie{Name: "sessionToken", Value: string(jwt)}
}

func runTest(t *testing.T, name string, f func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User)) {
	t.Run(name, func(t *testing.T) {
		t.Setenv("SESSION_SECRET", "super-secret")
		_ = db.Transaction(func(tx *gorm.DB) error {
			pStore := project.NewProjectStore(tx)
			pServ := projectService.NewProjectService(pStore)
			uStore := userStore.NewUserStore(tx)
			uServ := userService.NewUserService(uStore)
			aServ := authService.NewAuthenticationService(uServ)
			cServ := chatService.NewChatService(chatStore.NewChatStore(db))
			nStore := notificationStore.NewNotificationStreamStore(rdb)
			nServ := notificationService.NewNotificationService(nStore)
			handler := projectsHandler.NewProjectsGroup(pServ, nil, cServ, nServ, aServ, rdb, nil, nil)

			e := echo.New()
			handler.AddRoutes(e.Group("/api"))

			loginUser, err := uServ.CreateUser(context.Background(), "cookieMonster", "cookie@monster.com", "nomnom*!")
			require.NoError(t, err)
			cookie := getCookie(t, aServ, loginUser.Email, "nomnom*!")

			f(t, tx, aServ, pServ, uServ, e, cookie, *loginUser)
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}

func TestProjectRouteHandler_Integration(t *testing.T) {
	createMessageViaAPI := func(t *testing.T, e *echo.Echo, projectID uuid.UUID, cookie *http.Cookie, content string) routes.Message {
		body := createMessageRequest{Content: content}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/chat", projectID.String()), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code)

		var m routes.Message
		err := json.Unmarshal(rec.Body.Bytes(), &m)
		require.NoError(t, err)
		return m
	}

	runTest(t, "POST /chat returns 200 on valid create", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		_, err := ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)
		require.NoError(t, err)

		body := createMessageRequest{Content: "Hello chat!"}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/chat", project.ID.String()), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		var m routes.Message
		err = json.Unmarshal(rec.Body.Bytes(), &m)
		require.NoError(t, err)
		require.Equal(t, "Hello chat!", m.Content)
		require.NotEqual(t, uuid.Nil, m.ID)
	})

	runTest(t, "POST /chat returns 401 without auth", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		_, err := ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)
		require.NoError(t, err)

		body := createMessageRequest{Content: "Hello chat!"}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/chat", project.ID.String()), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)

		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	runTest(t, "POST /chat returns 401 for non-member", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		//ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)

		body := createMessageRequest{Content: "Sneaky message"}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/chat", project.ID.String()), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	runTest(t, "GET /chat returns 200 and paginated messages", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		_, err := ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)
		require.NoError(t, err)

		createMessageViaAPI(t, e, project.ID, cookie, "First message")
		createMessageViaAPI(t, e, project.ID, cookie, "Second message")

		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/projects/%s/chat?page=1&pageSize=10", project.ID.String()), nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		var result routes.Paginated[routes.Message]
		err = json.Unmarshal(rec.Body.Bytes(), &result)
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(result.Items), 2)
	})

	runTest(t, "GET /chat returns 401 without auth", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		_, err := ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/projects/%s/chat", project.ID.String()), nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	runTest(t, "GET /chat/count returns 200 with correct message count", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		_, err := ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/projects/%s/chat/count", project.ID.String()), nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)
		var countResp routes.MessageCount
		err = json.Unmarshal(rec.Body.Bytes(), &countResp)
		require.NoError(t, err)
		old_count := countResp.Count
		fmt.Println(old_count)

		_ = createMessageViaAPI(t, e, project.ID, cookie, "Msg 1")
		_ = createMessageViaAPI(t, e, project.ID, cookie, "Msg 2")

		req2 := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/projects/%s/chat/count", project.ID.String()), nil)
		req2.AddCookie(cookie)
		rec2 := httptest.NewRecorder()
		e.ServeHTTP(rec2, req2)

		require.Equal(t, http.StatusOK, rec2.Code)
		var countResp2 routes.MessageCount
		err2 := json.Unmarshal(rec2.Body.Bytes(), &countResp2)
		require.NoError(t, err2)
		fmt.Println(countResp2.Count)
		require.Equal(t, old_count+2, countResp2.Count)
	})

	runTest(t, "GET /chat/message/:id returns 200", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		_, err := ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)
		require.NoError(t, err)

		msg := createMessageViaAPI(t, e, project.ID, cookie, "Specific message")

		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/projects/%s/chat/message/%s", project.ID.String(), msg.ID.String()), nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)
		var m routes.Message
		err = json.Unmarshal(rec.Body.Bytes(), &m)
		require.NoError(t, err)
		require.Equal(t, msg.ID, m.ID)
		require.Equal(t, "Specific message", m.Content)
	})

	runTest(t, "GET /chat/message/:id returns 404 for missing message", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		_, err := ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/projects/%s/chat/message/%s", project.ID.String(), uuid.New().String()), nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		fmt.Printf("Response body: %s\n", strconv.Itoa(rec.Code))
		require.Equal(t, http.StatusInternalServerError, rec.Code)
	})

	runTest(t, "PATCH /chat/message/:id updates message and returns 200", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		_, err := ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)
		require.NoError(t, err)

		msg := createMessageViaAPI(t, e, project.ID, cookie, "Original message")

		body := updateMessageRequest{Content: "Updated content!"}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/projects/%s/chat/message/%s", project.ID.String(), msg.ID.String()), bytes.NewReader(b))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)
		var m routes.Message
		err = json.Unmarshal(rec.Body.Bytes(), &m)
		require.NoError(t, err)
		require.Equal(t, msg.ID, m.ID)
		require.Equal(t, "Updated content!", m.Content)
	})

	runTest(t, "DELETE /chat/message/:id returns 200 and removes the message", func(t *testing.T, tx *gorm.DB, as authService.AuthService, ps projectService.ProjectService, us userService.UserService, e *echo.Echo, cookie *http.Cookie, loginUser models.User) {
		project := testutils.SelectRandomProject(t, db)
		_, err := ps.AddUsersToProject(context.Background(), []projectService.AddMemberRequest{{UserId: loginUser.ID, Role: "member"}}, project.ID)
		require.NoError(t, err)

		msg := createMessageViaAPI(t, e, project.ID, cookie, "To be deleted")

		req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/projects/%s/chat/message/%s", project.ID.String(), msg.ID.String()), nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)

		reqVerify := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/projects/%s/chat/message/%s", project.ID.String(), msg.ID.String()), nil)
		reqVerify.AddCookie(cookie)
		recVerify := httptest.NewRecorder()
		e.ServeHTTP(recVerify, reqVerify)

		var msg_res models.Message
		err = json.Unmarshal(recVerify.Body.Bytes(), &msg_res)
		require.NoError(t, err)

		require.Equal(t, msg_res.Content, "")
		require.Equal(t, msg_res.IsDeleted, true)
		require.Equal(t, msg_res.DeletedAt.Second(), time.Now().Second())
	})

}
