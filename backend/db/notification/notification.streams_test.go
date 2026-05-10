package notification_test

import (
	notificationdb "backend/db/notification"
	"backend/testutils"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

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

func TestNotificationStreamStoreAppendAndRangeRoundTripsNotification(t *testing.T) {
	userID := uuid.New()
	otherUserID := uuid.New()
	runNotificationStreamStoreTransaction(t, []uuid.UUID{userID, otherUserID}, func(store notificationdb.NotificationStreamStore) {
		expected := testNotification(userID, "task", "task assigned", false)
		expected.EditType = "created"
		otherNotification := testNotification(otherUserID, "project", "project updated", false)

		redisID, err := store.Append(t.Context(), expected)
		require.NoError(t, err)
		require.NotEmpty(t, redisID)

		_, err = store.Append(t.Context(), otherNotification)
		require.NoError(t, err)

		entries, err := store.Range(t.Context(), userID, "-", 10)
		require.NoError(t, err)
		require.Len(t, entries, 1)
		assert.Equal(t, redisID, entries[0].RedisID)
		assert.Equal(t, expected, entries[0].Notification)

		otherEntries, err := store.Range(t.Context(), otherUserID, "-", 10)
		require.NoError(t, err)
		require.Len(t, otherEntries, 1)
		assert.Equal(t, otherNotification, otherEntries[0].Notification)
	})
}

func TestNotificationStreamStoreAppendManyStoresNotificationsAcrossUsers(t *testing.T) {
	userID := uuid.New()
	otherUserID := uuid.New()
	runNotificationStreamStoreTransaction(t, []uuid.UUID{userID, otherUserID}, func(store notificationdb.NotificationStreamStore) {
		first := testNotification(userID, "task", "first", false)
		second := testNotification(otherUserID, "project", "second", false)
		third := testNotification(userID, "task", "third", false)

		redisIDs, err := store.AppendMany(t.Context(), []notificationdb.Notification{first, second, third})
		require.NoError(t, err)
		require.Len(t, redisIDs, 3)
		assert.NotEmpty(t, redisIDs[0])
		assert.NotEmpty(t, redisIDs[1])
		assert.NotEmpty(t, redisIDs[2])

		entries, err := store.Range(t.Context(), userID, "-", 10)
		require.NoError(t, err)
		require.Len(t, entries, 2)
		assert.Equal(t, first, entries[0].Notification)
		assert.Equal(t, third, entries[1].Notification)

		otherEntries, err := store.Range(t.Context(), otherUserID, "-", 10)
		require.NoError(t, err)
		require.Len(t, otherEntries, 1)
		assert.Equal(t, second, otherEntries[0].Notification)

		assertNotificationStreamTTL(t, userID)
		assertNotificationStreamTTL(t, otherUserID)
	})
}

func TestNotificationStreamStoreRangeHonorsStartAndCount(t *testing.T) {
	userID := uuid.New()
	runNotificationStreamStoreTransaction(t, []uuid.UUID{userID}, func(store notificationdb.NotificationStreamStore) {
		first := testNotification(userID, "task", "first", false)
		second := testNotification(userID, "task", "second", false)
		third := testNotification(userID, "task", "third", false)

		firstID, err := store.Append(t.Context(), first)
		require.NoError(t, err)
		secondID, err := store.Append(t.Context(), second)
		require.NoError(t, err)
		thirdID, err := store.Append(t.Context(), third)
		require.NoError(t, err)

		entries, err := store.Range(t.Context(), userID, secondID, 2)
		require.NoError(t, err)
		require.Len(t, entries, 2)
		assert.NotEqual(t, firstID, entries[0].RedisID)
		assert.Equal(t, secondID, entries[0].RedisID)
		assert.Equal(t, second, entries[0].Notification)
		assert.Equal(t, thirdID, entries[1].RedisID)
		assert.Equal(t, third, entries[1].Notification)
	})
}

func TestNotificationStreamStoreDeleteRemovesOnlyRequestedEntries(t *testing.T) {
	userID := uuid.New()
	otherUserID := uuid.New()
	runNotificationStreamStoreTransaction(t, []uuid.UUID{userID, otherUserID}, func(store notificationdb.NotificationStreamStore) {
		deletedNotification := testNotification(userID, "task", "delete me", false)
		remainingNotification := testNotification(userID, "task", "keep me", false)
		otherNotification := testNotification(otherUserID, "task", "other user", false)

		deletedRedisID, err := store.Append(t.Context(), deletedNotification)
		require.NoError(t, err)
		remainingRedisID, err := store.Append(t.Context(), remainingNotification)
		require.NoError(t, err)
		_, err = store.Append(t.Context(), otherNotification)
		require.NoError(t, err)

		err = store.Delete(t.Context(), userID, deletedRedisID)
		require.NoError(t, err)

		entries, err := store.Range(t.Context(), userID, "-", 10)
		require.NoError(t, err)
		require.Len(t, entries, 1)
		assert.Equal(t, remainingRedisID, entries[0].RedisID)
		assert.Equal(t, remainingNotification, entries[0].Notification)

		otherEntries, err := store.Range(t.Context(), otherUserID, "-", 10)
		require.NoError(t, err)
		require.Len(t, otherEntries, 1)
		assert.Equal(t, otherNotification, otherEntries[0].Notification)
	})
}

func TestNotificationStreamStoreRangeReturnsParseErrorForMalformedEntry(t *testing.T) {
	userID := uuid.New()
	runNotificationStreamStoreTransaction(t, []uuid.UUID{userID}, func(store notificationdb.NotificationStreamStore) {
		_, err := rdb.XAdd(t.Context(), &redis.XAddArgs{
			Stream: notificationStreamKey(userID),
			Values: map[string]any{
				"id":          "not-a-uuid",
				"user_id":     userID.String(),
				"object_type": "task",
				"object_id":   uuid.New().String(),
				"message":     "malformed entry",
				"read":        "false",
			},
		}).Result()
		require.NoError(t, err)

		entries, err := store.Range(t.Context(), userID, "-", 10)
		require.ErrorIs(t, err, notificationdb.ErrParseNotificationFromStreamEntry)
		assert.Nil(t, entries)
	})
}

func testNotification(userID uuid.UUID, objectType string, message string, read bool) notificationdb.Notification {
	return notificationdb.Notification{
		ID:         uuid.New(),
		UserID:     userID,
		ObjectType: objectType,
		ObjectID:   uuid.New(),
		Message:    message,
		Read:       read,
	}
}

func TestNotificationStreamStoreAppendRefreshesTTL(t *testing.T) {
	userID := uuid.New()
	runNotificationStreamStoreTransaction(t, []uuid.UUID{userID}, func(store notificationdb.NotificationStreamStore) {
		_, err := store.Append(t.Context(), testNotification(userID, "task", "ttl", false))
		require.NoError(t, err)

		assertNotificationStreamTTL(t, userID)
	})
}

func TestNotificationStreamStoreAppendCapsStreamAtMaximumLength(t *testing.T) {
	userID := uuid.New()
	runNotificationStreamStoreTransaction(t, []uuid.UUID{userID}, func(store notificationdb.NotificationStreamStore) {
		extraNotifications := int64(5)
		for i := int64(0); i < notificationdb.NotificationStreamMaxLen+extraNotifications; i++ {
			_, err := store.Append(t.Context(), testNotification(userID, "task", fmt.Sprintf("notification-%03d", i), false))
			require.NoError(t, err)
		}

		streamLength, err := rdb.XLen(t.Context(), notificationStreamKey(userID)).Result()
		require.NoError(t, err)
		require.Equal(t, notificationdb.NotificationStreamMaxLen, streamLength)

		entries, err := store.Range(t.Context(), userID, "-", notificationdb.NotificationStreamMaxLen+extraNotifications)
		require.NoError(t, err)
		require.Len(t, entries, int(notificationdb.NotificationStreamMaxLen))
		assert.Equal(t, "notification-005", entries[0].Notification.Message)
	})
}

func runNotificationStreamStoreTransaction(
	t *testing.T,
	userIDs []uuid.UUID,
	f func(notificationdb.NotificationStreamStore),
) {
	t.Helper()

	testutils.RunRedisTestTransaction(t, rdb, notificationStreamKeys(userIDs...), func() {
		f(notificationdb.NewNotificationStreamStore(rdb))
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

func assertNotificationStreamTTL(t *testing.T, userID uuid.UUID) {
	t.Helper()

	ttl, err := rdb.TTL(t.Context(), notificationStreamKey(userID)).Result()
	require.NoError(t, err)
	assert.Greater(t, ttl, 29*24*time.Hour)
	assert.LessOrEqual(t, ttl, notificationdb.NotificationStreamTTL)
}
