package websocket

import (
	notificationdb "backend/db/notification"
	"backend/routes"
	"backend/services/auth"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

const (
	notificationReadCount             int64 = 10
	notificationReadBlock                   = 30 * time.Second
	notificationWSMessageTypeSnapshot       = "notifications.snapshot"
	notificationWSMessageTypeNew            = "notifications.new"
	notificationWSMessageTypeOld            = "notifications.old"
)

type notificationWSMessage struct {
	Type    string                      `json:"type"`
	Payload notificationdb.Notification `json:"payload"`
}

type notificationWSSnapshotPayload struct {
	New      []notificationdb.Notification `json:"new"`
	Old      []notificationdb.Notification `json:"old"`
	NewCount int                           `json:"new_count"`
	OldCount int                           `json:"old_count"`
}

type notificationWSSnapshotMessage struct {
	Type    string                        `json:"type"`
	Payload notificationWSSnapshotPayload `json:"payload"`
}

type notificationWSSnapshotPayloadResponse struct { //nolint:unused
	New      []routes.NotificationResponse `json:"new"`
	Old      []routes.NotificationResponse `json:"old"`
	NewCount int                           `json:"new_count"`
	OldCount int                           `json:"old_count"`
}

type notificationWSSnapshotMessageResponse struct { //nolint:unused
	Type    string                                `json:"type" example:"notifications.snapshot"`
	Payload notificationWSSnapshotPayloadResponse `json:"payload"`
}

type notificationWSRouteHandler struct {
	authService auth.AuthService
	upgrader    websocket.Upgrader
	rdb         *redis.Client
	store       notificationdb.NotificationStreamStore
}

func newNotificationWSRouteHandler(authService auth.AuthService, rdb *redis.Client) notificationWSRouteHandler {
	return notificationWSRouteHandler{
		authService: authService,
		rdb:         rdb,
		store:       notificationdb.NewNotificationStreamStore(rdb),
		upgrader:    newWSUpgrader(),
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
//	@Description	After successful handshake, server sends a "notifications.snapshot" envelope, then live "notifications.new" or "notifications.old" envelopes.
//	@Tags		notifications
//	@Success	101	{object}	notificationWSSnapshotMessageResponse	"Switching Protocols. Subsequent WebSocket text frames contain notification envelopes."
//	@Failure	401	{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	500	{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/ws/notifications [get]
func (h notificationWSRouteHandler) connectGET(c *echo.Context) error {
	ctx := c.Request().Context()

	claims := h.authService.GetClaims(c)
	expiry := claims.ExpiresAt.Time
	if isWSSessionExpired(expiry) {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	ws, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade notification websocket", "error", err)
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	defer func() {
		if err := ws.Close(); err != nil {
			slog.Error("failed to close notification websocket connection", "error", err)
		}
	}()

	redisCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	disconnectCh := make(chan error, 1)
	go consumeNotificationWSDisconnect(ws, cancel, disconnectCh)

	lastID, err := h.writeNotificationSnapshot(ctx, ws, claims.UserID)
	if err != nil {
		slog.Error("notification websocket snapshot error", "error", err, "userid", claims.UserID)
		return nil
	}

	for {
		if expiry.Before(time.Now()) {
			slog.Debug("notification websocket session expired, closing connection", "userid", claims.UserID)
			break
		}

		streams, err := h.rdb.XRead(redisCtx, &redis.XReadArgs{
			Streams: []string{notificationdb.NotificationStreamKey(claims.UserID), lastID},
			Count:   notificationReadCount,
			Block:   notificationReadBlock,
		}).Result()
		if err != nil {
			if disconnectErr, ok := notificationWSDisconnectErr(disconnectCh); ok {
				logNotificationWSDisconnect(disconnectErr, claims.UserID)
				return nil
			}

			if errors.Is(err, context.Canceled) {
				return nil
			}

			if ctx.Err() != nil {
				return nil
			}

			if err == redis.Nil {
				continue
			}

			slog.Error("notification websocket read error", "error", err, "userid", claims.UserID)
			break
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				lastID = msg.ID
				notification, err := notificationdb.NotificationFromStreamValues(msg.Values)
				if err != nil {
					slog.Error("notification websocket parse error", "error", err, "userid", claims.UserID)
					continue
				}

				if err := ws.WriteJSON(notificationWSMessage{
					Type:    notificationLiveMessageType(notification),
					Payload: notification,
				}); err != nil {
					slog.Error("notification websocket write error", "error", err)
					return nil
				}
			}
		}
	}

	slog.Debug("closing notification websocket connection", "userid", claims.UserID)
	return nil
}

func consumeNotificationWSDisconnect(conn *websocket.Conn, cancel context.CancelFunc, errCh chan<- error) {
	defer cancel()
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			errCh <- err
			return
		}
	}
}

func notificationWSDisconnectErr(disconnectCh <-chan error) (error, bool) {
	select {
	case err := <-disconnectCh:
		return err, true
	default:
		return nil, false
	}
}

func logNotificationWSDisconnect(err error, userID uuid.UUID) {
	if err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		slog.Debug("notification ws closed", "error", err, "user-id", userID)
	}
}

func (h notificationWSRouteHandler) writeNotificationSnapshot(ctx context.Context, ws *websocket.Conn, userID uuid.UUID) (string, error) {
	entries, err := h.store.Range(ctx, userID, "-", notificationdb.NotificationStreamMaxLen)
	if err != nil {
		return "", err
	}

	notifications := collapseNotificationEntries(entries)
	newNotifications, oldNotifications := splitNotificationsByReadState(notifications)
	lastID := "0-0"
	if len(entries) > 0 {
		lastID = entries[len(entries)-1].RedisID
	}

	err = ws.WriteJSON(notificationWSSnapshotMessage{
		Type: notificationWSMessageTypeSnapshot,
		Payload: notificationWSSnapshotPayload{
			New:      newNotifications,
			Old:      oldNotifications,
			NewCount: len(newNotifications),
			OldCount: len(oldNotifications),
		},
	})
	if err != nil {
		return "", err
	}

	return lastID, nil
}

func collapseNotificationEntries(entries []notificationdb.NotificationStreamEntry) []notificationdb.Notification {
	if len(entries) == 0 {
		return []notificationdb.Notification{}
	}

	notificationsByID := make(map[uuid.UUID]notificationdb.Notification, len(entries))
	order := make([]uuid.UUID, 0, len(entries))
	for _, entry := range entries {
		notification := entry.Notification
		if _, exists := notificationsByID[notification.ID]; !exists {
			order = append(order, notification.ID)
		}
		notificationsByID[notification.ID] = notification
	}

	result := make([]notificationdb.Notification, 0, len(order))
	for _, notificationID := range order {
		result = append(result, notificationsByID[notificationID])
	}

	return result
}

func splitNotificationsByReadState(notifications []notificationdb.Notification) ([]notificationdb.Notification, []notificationdb.Notification) {
	newNotifications := make([]notificationdb.Notification, 0, len(notifications))
	oldNotifications := make([]notificationdb.Notification, 0, len(notifications))
	for _, notification := range notifications {
		if notification.Read {
			oldNotifications = append(oldNotifications, notification)
			continue
		}
		newNotifications = append(newNotifications, notification)
	}

	return newNotifications, oldNotifications
}

func notificationLiveMessageType(notification notificationdb.Notification) string {
	if notification.Read {
		return notificationWSMessageTypeOld
	}

	return notificationWSMessageTypeNew
}
