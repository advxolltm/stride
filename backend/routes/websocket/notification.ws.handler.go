package websocket

import (
	notificationdb "backend/db/notification"
	"backend/routes"
	"backend/services/auth"
	"backend/services/project"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

const (
	notificationStreamPrefix  = "notifications:user"
	notificationReadCount int64 = 10
	notificationReadBlock      = 30 * time.Second
)

type notificationWSMessage struct {
	Type    string                    `json:"type"`
	Payload notificationdb.Notification `json:"payload"`
}

type notificationWSMessageResponse struct { //nolint:unused
	Type    string                     `json:"type" example:"notification"`
	Payload routes.NotificationResponse `json:"payload"`
}

type notificationWSRouteHandler struct {
	authService auth.AuthService
	projectService project.ProjectService
	upgrader       websocket.Upgrader
	rdb            *redis.Client
}

func newNotificationWSRouteHandler(authService auth.AuthService, projectService project.ProjectService, rdb *redis.Client) notificationWSRouteHandler {
	return notificationWSRouteHandler{
		authService:    authService,
		projectService: projectService,
		rdb:            rdb,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (h notificationWSRouteHandler) addRoutes(ws *echo.Group) {
	g := ws.Group("/notifications", h.authService.AuthenticatedMiddleware())
	g.GET("", h.connectGET)
}

// GET /ws/notifications
//
//	@Summary	Connect to notification updates websocket
//	@Description	Upgrades HTTP connection to WebSocket for authenticated user notification delivery.
//	@Description	After successful handshake, server sends JSON envelopes with type "notification" and payload containing notification data.
//	@Tags		notifications
//	@Success	101	{object}	notificationWSMessageResponse	"Switching Protocols. Subsequent WebSocket text frames contain notification envelopes."
//	@Failure	401	{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	500	{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/ws/notifications [get]
func (h notificationWSRouteHandler) connectGET(c *echo.Context) error {
	ctx := c.Request().Context()

	claims := h.authService.GetClaims(c)
	expiry := claims.ExpiresAt.Time

	ws, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade notification websocket", "error", err)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	defer ws.Close()

	lastID := "$"
	for {
		if expiry.Before(time.Now()) {
			slog.Debug("notification websocket session expired, closing connection", "userid", claims.UserID)
			break
		}

		streams, err := h.rdb.XRead(ctx, &redis.XReadArgs{
			Streams: []string{notificationStreamKey(claims.UserID), lastID},
			Count:   notificationReadCount,
			Block:   notificationReadBlock,
		}).Result()
		if err != nil {
			if ctx.Err() != nil || err == redis.Nil {
				continue
			}

			slog.Error("notification websocket read error", "error", err, "userid", claims.UserID)
			break
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				notification, err := notificationFromStreamValues(msg.Values)
				if err != nil {
					slog.Error("notification websocket parse error", "error", err, "userid", claims.UserID)
					continue
				}

				lastID = msg.ID
				if err := ws.WriteJSON(notificationWSMessage{Type: "notification", Payload: notification}); err != nil {
					slog.Error("notification websocket write error", "error", err)
					return nil
				}
			}
		}
	}

	slog.Debug("closing notification websocket connection", "userid", claims.UserID)
	return nil
}

func notificationStreamKey(userID uuid.UUID) string {
	return fmt.Sprintf("%s:%s", notificationStreamPrefix, userID.String())
}

func notificationFromStreamValues(values map[string]any) (notificationdb.Notification, error) {
	id, err := uuid.Parse(notificationStreamValueAsString(values["id"]))
	if err != nil {
		return notificationdb.Notification{}, err
	}

	userID, err := uuid.Parse(notificationStreamValueAsString(values["user_id"]))
	if err != nil {
		return notificationdb.Notification{}, err
	}

	objectID, err := uuid.Parse(notificationStreamValueAsString(values["object_id"]))
	if err != nil {
		return notificationdb.Notification{}, err
	}

	read, err := strconv.ParseBool(notificationStreamValueAsString(values["read"]))
	if err != nil {
		return notificationdb.Notification{}, err
	}

	return notificationdb.Notification{
		ID:         id,
		UserID:     userID,
		EditType:   notificationStreamValueAsString(values["edit_type"]),
		ObjectType: notificationStreamValueAsString(values["object_type"]),
		ObjectID:   objectID,
		Message:    notificationStreamValueAsString(values["message"]),
		Read:       read,
	}, nil
}

func notificationStreamValueAsString(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		return fmt.Sprint(v)
	}
}