package websocket

import (
	notificationdb "backend/db/notification"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNotificationSnapshotHelpersCollapseAndSplitByReadState(t *testing.T) {
	userID := uuid.New()
	firstNotificationID := uuid.New()
	secondNotificationID := uuid.New()

	entries := []notificationdb.NotificationStreamEntry{
		{
			RedisID: "1-0",
			Notification: testWSNotification(
				firstNotificationID,
				userID,
				"first",
				false,
			),
		},
		{
			RedisID: "2-0",
			Notification: testWSNotification(
				firstNotificationID,
				userID,
				"first",
				true,
			),
		},
		{
			RedisID: "3-0",
			Notification: testWSNotification(
				secondNotificationID,
				userID,
				"second",
				false,
			),
		},
	}

	notifications := collapseNotificationEntries(entries)
	require.Len(t, notifications, 2)
	assert.Equal(t, firstNotificationID, notifications[0].ID)
	assert.True(t, notifications[0].Read)
	assert.Equal(t, secondNotificationID, notifications[1].ID)
	assert.False(t, notifications[1].Read)

	newNotifications, oldNotifications := splitNotificationsByReadState(notifications)
	require.Len(t, newNotifications, 1)
	require.Len(t, oldNotifications, 1)
	assert.Equal(t, secondNotificationID, newNotifications[0].ID)
	assert.Equal(t, firstNotificationID, oldNotifications[0].ID)
	assert.Equal(t, notificationWSMessageTypeNew, notificationLiveMessageType(newNotifications[0]))
	assert.Equal(t, notificationWSMessageTypeOld, notificationLiveMessageType(oldNotifications[0]))
}

func testWSNotification(id uuid.UUID, userID uuid.UUID, message string, read bool) notificationdb.Notification {
	return notificationdb.Notification{
		ID:         id,
		UserID:     userID,
		ObjectType: "task",
		ObjectID:   uuid.New(),
		Message:    message,
		Read:       read,
	}
}
