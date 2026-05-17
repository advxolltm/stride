package websocket

import (
	"backend/routes"
	"backend/services/auth"
	"backend/services/project"
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
)

const (
	wsWriteWait      = 10 * time.Second
	wsPongWait       = 60 * time.Second
	wsPingPeriod     = (wsPongWait * 9) / 10
	wsMaxMessageSize = 1 << 20
)

type projectWSSession struct {
	ProjectID uuid.UUID
	UserID    uuid.UUID
	Expiry    time.Time
}

func newWSUpgrader() websocket.Upgrader {
	return websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
}

func authorizeProjectWSSession(
	c *echo.Context,
	authService auth.AuthService,
	projectService project.ProjectService,
) (*projectWSSession, error) {
	ctx := c.Request().Context()
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		return nil, c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	claims := authService.GetClaims(c)
	isProjectMember, err := projectService.IsProjectMember(ctx, claims.UserID, projectID)
	if err != nil || !isProjectMember {
		return nil, c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	return &projectWSSession{
		ProjectID: projectID,
		UserID:    claims.UserID,
		Expiry:    claims.ExpiresAt.Time,
	}, nil
}

func isWSSessionExpired(expiry time.Time) bool {
	return !expiry.IsZero() && expiry.Before(time.Now())
}

func writeWSMessage(conn *websocket.Conn, writeMu *sync.Mutex, messageType int, payload []byte) error {
	writeMu.Lock()
	defer writeMu.Unlock()

	if err := conn.SetWriteDeadline(time.Now().Add(wsWriteWait)); err != nil {
		return err
	}
	return conn.WriteMessage(messageType, payload)
}

func pingWSConn(
	ctx context.Context,
	conn *websocket.Conn,
	writeMu *sync.Mutex,
	errCh chan<- error,
) {
	ticker := time.NewTicker(wsPingPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			errCh <- nil
			return
		case <-ticker.C:
			if err := writeWSMessage(conn, writeMu, websocket.PingMessage, nil); err != nil {
				errCh <- err
				return
			}
		}
	}
}
