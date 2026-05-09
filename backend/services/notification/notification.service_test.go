package notification_test

import (
	notificationdb "backend/db/notification"
	notificationservice "backend/services/notification"
	"backend/testutils"
	"log"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var rdb *redis.Client

func TestMain(m *testing.M) {
	rdb = testutils.SetupLiveRedisFromEnvOrLocal()

	code := m.Run()

	if err := rdb.Close(); err != nil {
		log.Printf("failed to close redis client: %v", err)
	}

	os.Exit(code)
}

func TestNotificationServiceSendNotificationStoresUnreadNotification(t *testing.T) {
	userID := uuid.New()
	otherUserID := uuid.New()
	runNotificationServiceTransaction(t, []uuid.UUID{userID, otherUserID}, func(svc notificationservice.NotificationService) {
		objectID := uuid.New()

		err := svc.SendNotification(t.Context(), userID, "task", objectID, "task assigned")
		require.NoError(t, err)

		notifications, err := svc.GetNotifications(t.Context(), userID)
		require.NoError(t, err)
		require.Len(t, notifications, 1)

		assert.NotEqual(t, uuid.Nil, notifications[0].ID)
		assert.Equal(t, userID, notifications[0].UserID)
		assert.Equal(t, "task", notifications[0].ObjectType)
		assert.Equal(t, objectID, notifications[0].ObjectID)
		assert.Equal(t, "task assigned", notifications[0].Message)
		assert.False(t, notifications[0].Read)

		otherNotifications, err := svc.GetNotifications(t.Context(), otherUserID)
		require.NoError(t, err)
		assert.Empty(t, otherNotifications)
	})
}

func TestNotificationServiceSendBulkNotificationStoresUnreadNotificationForEachUniqueUser(t *testing.T) {
	firstUserID := uuid.New()
	secondUserID := uuid.New()
	runNotificationServiceTransaction(t, []uuid.UUID{firstUserID, secondUserID}, func(svc notificationservice.NotificationService) {
		rawStore := notificationdb.NewNotificationStreamStore(rdb)
		objectID := uuid.New()

		err := svc.SendBulkNotification(
			t.Context(),
			uuid.UUIDs{firstUserID, secondUserID, firstUserID},
			"task",
			objectID,
			"task assigned",
		)
		require.NoError(t, err)

		firstNotifications, err := svc.GetNotifications(t.Context(), firstUserID)
		require.NoError(t, err)
		require.Len(t, firstNotifications, 1)
		assert.Equal(t, firstUserID, firstNotifications[0].UserID)
		assert.Equal(t, "task", firstNotifications[0].ObjectType)
		assert.Equal(t, objectID, firstNotifications[0].ObjectID)
		assert.Equal(t, "task assigned", firstNotifications[0].Message)
		assert.False(t, firstNotifications[0].Read)

		secondNotifications, err := svc.GetNotifications(t.Context(), secondUserID)
		require.NoError(t, err)
		require.Len(t, secondNotifications, 1)
		assert.Equal(t, secondUserID, secondNotifications[0].UserID)
		assert.Equal(t, "task", secondNotifications[0].ObjectType)
		assert.Equal(t, objectID, secondNotifications[0].ObjectID)
		assert.Equal(t, "task assigned", secondNotifications[0].Message)
		assert.False(t, secondNotifications[0].Read)

		firstEntries, err := rawStore.Range(t.Context(), firstUserID, "-", 10)
		require.NoError(t, err)
		assert.Len(t, firstEntries, 1)

		secondEntries, err := rawStore.Range(t.Context(), secondUserID, "-", 10)
		require.NoError(t, err)
		assert.Len(t, secondEntries, 1)
	})
}

func TestNotificationServiceMarkAsReadCollapsesToLatestState(t *testing.T) {
	userID := uuid.New()
	runNotificationServiceTransaction(t, []uuid.UUID{userID}, func(svc notificationservice.NotificationService) {
		rawStore := notificationdb.NewNotificationStreamStore(rdb)

		err := svc.SendNotification(t.Context(), userID, "task", uuid.New(), "task moved")
		require.NoError(t, err)

		notifications, err := svc.GetNotifications(t.Context(), userID)
		require.NoError(t, err)
		require.Len(t, notifications, 1)
		notificationID := notifications[0].ID

		err = svc.MarkAsRead(t.Context(), userID, notificationID)
		require.NoError(t, err)

		notifications, err = svc.GetNotifications(t.Context(), userID)
		require.NoError(t, err)
		require.Len(t, notifications, 1)
		assert.Equal(t, notificationID, notifications[0].ID)
		assert.True(t, notifications[0].Read)

		rawEntries, err := rawStore.Range(t.Context(), userID, "-", 10)
		require.NoError(t, err)
		require.Len(t, rawEntries, 2)
		assert.Equal(t, notificationID, rawEntries[0].Notification.ID)
		assert.False(t, rawEntries[0].Notification.Read)
		assert.Equal(t, notificationID, rawEntries[1].Notification.ID)
		assert.True(t, rawEntries[1].Notification.Read)
	})
}

func TestNotificationServiceDeleteNotificationRemovesAllEventsForNotification(t *testing.T) {
	userID := uuid.New()
	runNotificationServiceTransaction(t, []uuid.UUID{userID}, func(svc notificationservice.NotificationService) {
		rawStore := notificationdb.NewNotificationStreamStore(rdb)

		err := svc.SendNotification(t.Context(), userID, "task", uuid.New(), "task archived")
		require.NoError(t, err)

		notifications, err := svc.GetNotifications(t.Context(), userID)
		require.NoError(t, err)
		require.Len(t, notifications, 1)
		notificationID := notifications[0].ID

		err = svc.MarkAsRead(t.Context(), userID, notificationID)
		require.NoError(t, err)

		err = svc.DeleteNotification(t.Context(), userID, notificationID)
		require.NoError(t, err)

		notifications, err = svc.GetNotifications(t.Context(), userID)
		require.NoError(t, err)
		assert.Empty(t, notifications)

		rawEntries, err := rawStore.Range(t.Context(), userID, "-", 10)
		require.NoError(t, err)
		assert.Empty(t, rawEntries)
	})
}

func TestNotificationServiceValidationErrors(t *testing.T) {
	userID := uuid.New()
	runNotificationServiceTransaction(t, []uuid.UUID{userID}, func(svc notificationservice.NotificationService) {
		objectID := uuid.New()
		notificationID := uuid.New()

		tests := []struct {
			name string
			act  func() error
			want error
		}{
			{
				name: "send requires user id",
				act: func() error {
					return svc.SendNotification(t.Context(), uuid.Nil, "task", objectID, "message")
				},
				want: notificationservice.ErrNotificationUserIDRequired,
			},
			{
				name: "bulk send requires user ids",
				act: func() error {
					return svc.SendBulkNotification(t.Context(), nil, "task", objectID, "message")
				},
				want: notificationservice.ErrNotificationUserIDRequired,
			},
			{
				name: "bulk send requires valid user ids",
				act: func() error {
					return svc.SendBulkNotification(t.Context(), uuid.UUIDs{userID, uuid.Nil}, "task", objectID, "message")
				},
				want: notificationservice.ErrNotificationUserIDRequired,
			},
			{
				name: "send requires object type",
				act: func() error {
					return svc.SendNotification(t.Context(), userID, "   ", objectID, "message")
				},
				want: notificationservice.ErrNotificationObjectTypeRequired,
			},
			{
				name: "bulk send requires object type",
				act: func() error {
					return svc.SendBulkNotification(t.Context(), uuid.UUIDs{userID}, "   ", objectID, "message")
				},
				want: notificationservice.ErrNotificationObjectTypeRequired,
			},
			{
				name: "send requires object id",
				act: func() error {
					return svc.SendNotification(t.Context(), userID, "task", uuid.Nil, "message")
				},
				want: notificationservice.ErrNotificationObjectIDRequired,
			},
			{
				name: "send requires message",
				act: func() error {
					return svc.SendNotification(t.Context(), userID, "task", objectID, "  ")
				},
				want: notificationservice.ErrNotificationMessageRequired,
			},
			{
				name: "get requires user id",
				act: func() error {
					_, err := svc.GetNotifications(t.Context(), uuid.Nil)
					return err
				},
				want: notificationservice.ErrNotificationUserIDRequired,
			},
			{
				name: "mark read requires user id",
				act: func() error {
					return svc.MarkAsRead(t.Context(), uuid.Nil, notificationID)
				},
				want: notificationservice.ErrNotificationUserIDRequired,
			},
			{
				name: "mark read requires notification id",
				act: func() error {
					return svc.MarkAsRead(t.Context(), userID, uuid.Nil)
				},
				want: notificationservice.ErrNotificationIDRequired,
			},
			{
				name: "delete requires user id",
				act: func() error {
					return svc.DeleteNotification(t.Context(), uuid.Nil, notificationID)
				},
				want: notificationservice.ErrNotificationUserIDRequired,
			},
			{
				name: "delete requires notification id",
				act: func() error {
					return svc.DeleteNotification(t.Context(), userID, uuid.Nil)
				},
				want: notificationservice.ErrNotificationIDRequired,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := tt.act()
				require.ErrorIs(t, err, tt.want)
			})
		}
	})
}

func TestNotificationServiceReturnsNotFoundForUnknownNotification(t *testing.T) {
	userID := uuid.New()
	runNotificationServiceTransaction(t, []uuid.UUID{userID}, func(svc notificationservice.NotificationService) {
		unknownNotificationID := uuid.New()

		err := svc.MarkAsRead(t.Context(), userID, unknownNotificationID)
		require.ErrorIs(t, err, notificationservice.ErrNotificationNotFound)

		err = svc.DeleteNotification(t.Context(), userID, unknownNotificationID)
		require.ErrorIs(t, err, notificationservice.ErrNotificationNotFound)
	})
}

func runNotificationServiceTransaction(
	t *testing.T,
	userIDs []uuid.UUID,
	f func(notificationservice.NotificationService),
) {
	t.Helper()

	testutils.RunRedisTestTransaction(t, rdb, notificationStreamKeys(userIDs...), func() {
		store := notificationdb.NewNotificationStreamStore(rdb)
		f(notificationservice.NewNotificationService(store))
	})
}

func notificationStreamKeys(userIDs ...uuid.UUID) []string {
	keys := make([]string, 0, len(userIDs))
	for _, userID := range userIDs {
		keys = append(keys, notificationStreamKey(userID))
	}

	return keys
}

func notificationStreamKey(userID uuid.UUID) string {
	return notificationdb.NotificationStreamKey(userID)
}
