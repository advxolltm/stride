package chat_test

import (
	"backend/db/chat"
	"backend/models"
	"backend/testutils"
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

func newTestChatStore(db *gorm.DB) chat.ChatStore {
	return chat.NewChatStore(db)
}

func runTest(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, chat.ChatStore)) {
	t.Run(name, func(t *testing.T) {
		_ = db.Transaction(func(tx *gorm.DB) error {
			f(t, tx, newTestChatStore(tx))
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}

func TestChatStore(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "CreateChat", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		content := "Hello, World!"
		message := &models.Message{
			SenderID:  &proj.Members[0].ID,
			ProjectID: proj.ID,
			Content:   content,
		}
		err := cs.CreateMessage(ctx, message)
		require.NoError(t, err)
		var msg models.Message
		get_err := db.First(&msg, "id = ?", message.ID)
		require.NoError(t, get_err.Error)
		assert.Equal(t, content, msg.Content)
	})
	runTest(t, db, "GetChatByID", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		content := "Hello, World!"
		message := &models.Message{
			SenderID:  &proj.Members[0].ID,
			ProjectID: proj.ID,
			Content:   content,
		}
		err := cs.CreateMessage(ctx, message)
		require.NoError(t, err)
		var msg models.Message
		msg, get_err := cs.GetMessage(ctx, message.ID)
		require.NoError(t, get_err)
		assert.Equal(t, content, msg.Content)
	})
	runTest(t, db, "GetProjectChat", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)

		content := "Hello, World!"
		message := &models.Message{
			SenderID:  &proj.Members[0].ID,
			ProjectID: proj.ID,
			Content:   content,
		}
		err := cs.CreateMessage(ctx, message)
		require.NoError(t, err)
		msg_count, count_err := cs.GetMessageCount(ctx, proj.ID)
		require.NoError(t, count_err)
		chats, get_err := cs.GetProjectMessages(ctx, proj.ID, 0, 2*msg_count)
		require.NoError(t, get_err)
		assert.Len(t, chats.Items, msg_count)

		content = "Hello, World2!"
		message = &models.Message{
			SenderID:  &proj.Members[1].ID,
			ProjectID: proj.ID,
			Content:   content,
		}
		err_mgs2 := cs.CreateMessage(ctx, message)
		require.NoError(t, err_mgs2)

		chats, get_err = cs.GetProjectMessages(ctx, proj.ID, 0, 2*msg_count)
		require.NoError(t, get_err)
		assert.Len(t, chats.Items, msg_count+1)

	})
	runTest(t, db, "DeleteChat", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		content := "Hello, World!"
		message := &models.Message{
			SenderID:  &proj.Members[0].ID,
			ProjectID: proj.ID,
			Content:   content,
		}
		err := cs.CreateMessage(ctx, message)
		require.NoError(t, err)
		err = cs.DeleteMessage(ctx, message.ID)
		require.NoError(t, err)
		var msg models.Message
		getErr := db.First(&msg, "id = ?", message.ID)
		require.Error(t, getErr.Error)
		assert.True(t, errors.Is(getErr.Error, gorm.ErrRecordNotFound))
	})
	runTest(t, db, "EditChat", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		content := "Hello, World!"
		message := &models.Message{
			SenderID:  &proj.Members[0].ID,
			ProjectID: proj.ID,
			Content:   content,
		}
		err := cs.CreateMessage(ctx, message)
		require.NoError(t, err)

		newContent := "Hello, World! Edited."
		editedMsg, err := cs.UpdateMessage(ctx, message.ID, newContent)
		require.NoError(t, err)
		assert.Equal(t, newContent, editedMsg.Content)

		chats, get_err := cs.GetProjectMessages(ctx, proj.ID, 0, 1)
		require.NoError(t, get_err)
		assert.Equal(t, newContent, chats.Items[0].Content)
	})
	runTest(t, db, "GetMessageCount", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		proj2 := testutils.GenerateRandomProject(testutils.GenerateRandomUsers(1))
		require.NoError(t, db.Create(&proj2).Error)

		count_none, err_m1 := cs.GetMessageCount(ctx, proj2.ID)
		require.NoError(t, err_m1)
		assert.Equal(t, 0, count_none)

		count_before, err_m2 := cs.GetMessageCount(ctx, proj.ID)
		require.NoError(t, err_m2)

		content := "Hello, World!"
		message := &models.Message{
			SenderID:  &proj.Members[0].ID,
			ProjectID: proj.ID,
			Content:   content,
		}
		err := cs.CreateMessage(ctx, message)
		require.NoError(t, err)
		count, err := cs.GetMessageCount(ctx, proj.ID)
		require.NoError(t, err)
		assert.Equal(t, count_before+1, count)
	})
	runTest(t, db, "MarkDeliveredCreatesCursor", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		message := createTestMessage(t, cs, ctx, proj.ID, &proj.Members[0].ID, time.Now())

		cursor, err := cs.MarkDelivered(ctx, proj.ID, proj.Members[1].ID, message.ID)

		require.NoError(t, err)
		assert.Equal(t, proj.ID, cursor.ProjectID)
		assert.Equal(t, proj.Members[1].ID, cursor.ProjectMemberID)
		assert.Equal(t, message.ID, cursor.LastDeliveredMessageID)
		assert.True(t, cursor.LastDeliveredMessageCreatedAt.Equal(message.CreatedAt))
		assert.Nil(t, cursor.LastReadMessageID)
		assert.Nil(t, cursor.LastReadMessageCreatedAt)
		assert.Nil(t, cursor.ReadAt)
	})
	runTest(t, db, "MarkDeliveredDoesNotMoveCursorBackward", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		older := createTestMessage(t, cs, ctx, proj.ID, &proj.Members[0].ID, time.Now())
		newer := createTestMessage(t, cs, ctx, proj.ID, &proj.Members[0].ID, older.CreatedAt.Add(time.Minute))

		newerCursor, err := cs.MarkDelivered(ctx, proj.ID, proj.Members[1].ID, newer.ID)
		require.NoError(t, err)
		olderCursor, err := cs.MarkDelivered(ctx, proj.ID, proj.Members[1].ID, older.ID)

		require.NoError(t, err)
		assert.Equal(t, newerCursor.ID, olderCursor.ID)
		assert.Equal(t, newer.ID, olderCursor.LastDeliveredMessageID)
		assert.True(t, olderCursor.LastDeliveredMessageCreatedAt.Equal(newer.CreatedAt))
	})
	runTest(t, db, "MarkReadCreatesCursorAndMovesDeliveredForward", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		message := createTestMessage(t, cs, ctx, proj.ID, &proj.Members[0].ID, time.Now())

		cursor, err := cs.MarkRead(ctx, proj.ID, proj.Members[1].ID, message.ID)

		require.NoError(t, err)
		assert.Equal(t, message.ID, cursor.LastDeliveredMessageID)
		assert.True(t, cursor.LastDeliveredMessageCreatedAt.Equal(message.CreatedAt))
		require.NotNil(t, cursor.LastReadMessageID)
		assert.Equal(t, message.ID, *cursor.LastReadMessageID)
		require.NotNil(t, cursor.LastReadMessageCreatedAt)
		assert.True(t, cursor.LastReadMessageCreatedAt.Equal(message.CreatedAt))
		require.NotNil(t, cursor.ReadAt)
	})
	runTest(t, db, "MarkReadDoesNotMoveCursorBackward", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		older := createTestMessage(t, cs, ctx, proj.ID, &proj.Members[0].ID, time.Now())
		newer := createTestMessage(t, cs, ctx, proj.ID, &proj.Members[0].ID, older.CreatedAt.Add(time.Minute))

		newerCursor, err := cs.MarkRead(ctx, proj.ID, proj.Members[1].ID, newer.ID)
		require.NoError(t, err)
		olderCursor, err := cs.MarkRead(ctx, proj.ID, proj.Members[1].ID, older.ID)

		require.NoError(t, err)
		assert.Equal(t, newerCursor.ID, olderCursor.ID)
		require.NotNil(t, olderCursor.LastReadMessageID)
		assert.Equal(t, newer.ID, *olderCursor.LastReadMessageID)
		require.NotNil(t, olderCursor.LastReadMessageCreatedAt)
		assert.True(t, olderCursor.LastReadMessageCreatedAt.Equal(newer.CreatedAt))
	})
	runTest(t, db, "GetProjectChatCursorsReturnsOnlyTargetProject", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		projects := testutils.SelectRandomProjects(t, db, 2)
		firstMessage := createTestMessage(t, cs, ctx, projects[0].ID, &projects[0].Members[0].ID, time.Now())
		secondMessage := createTestMessage(t, cs, ctx, projects[1].ID, &projects[1].Members[0].ID, time.Now())
		_, err := cs.MarkDelivered(ctx, projects[0].ID, projects[0].Members[1].ID, firstMessage.ID)
		require.NoError(t, err)
		_, err = cs.MarkDelivered(ctx, projects[1].ID, projects[1].Members[1].ID, secondMessage.ID)
		require.NoError(t, err)

		cursors, err := cs.GetProjectChatCursors(ctx, projects[0].ID)

		require.NoError(t, err)
		require.Len(t, cursors, 1)
		assert.Equal(t, projects[0].ID, cursors[0].ProjectID)
		assert.Equal(t, projects[0].Members[1].ID, cursors[0].ProjectMemberID)
	})
	runTest(t, db, "MarkDeliveredReturnsErrMessageNotFoundForMessageFromAnotherProject", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		projects := testutils.SelectRandomProjects(t, db, 2)
		message := createTestMessage(t, cs, ctx, projects[1].ID, &projects[1].Members[0].ID, time.Now())

		_, err := cs.MarkDelivered(ctx, projects[0].ID, projects[0].Members[0].ID, message.ID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, chat.ErrMessageNotFound))
	})
	runTest(t, db, "MarkDeliveredReturnsErrMessageNotFoundForDeletedMessage", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		message := createTestMessage(t, cs, ctx, proj.ID, &proj.Members[0].ID, time.Now())
		require.NoError(t, cs.DeleteMessage(ctx, message.ID))

		_, err := cs.MarkDelivered(ctx, proj.ID, proj.Members[1].ID, message.ID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, chat.ErrMessageNotFound))
	})
	runTest(t, db, "MarkReadReturnsErrMessageNotFoundForMessageFromAnotherProject", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		projects := testutils.SelectRandomProjects(t, db, 2)
		message := createTestMessage(t, cs, ctx, projects[1].ID, &projects[1].Members[0].ID, time.Now())

		_, err := cs.MarkRead(ctx, projects[0].ID, projects[0].Members[0].ID, message.ID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, chat.ErrMessageNotFound))
	})
	runTest(t, db, "MarkReadReturnsErrMessageNotFoundForDeletedMessage", func(t *testing.T, db *gorm.DB, cs chat.ChatStore) {
		proj := testutils.SelectRandomProject(t, db)
		message := createTestMessage(t, cs, ctx, proj.ID, &proj.Members[0].ID, time.Now())
		require.NoError(t, cs.DeleteMessage(ctx, message.ID))

		_, err := cs.MarkRead(ctx, proj.ID, proj.Members[1].ID, message.ID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, chat.ErrMessageNotFound))
	})
}

func createTestMessage(t *testing.T, cs chat.ChatStore, ctx context.Context, projectID uuid.UUID, senderID *uuid.UUID, createdAt time.Time) models.Message {
	t.Helper()

	message := &models.Message{
		SenderID:  senderID,
		ProjectID: projectID,
		Content:   "cursor message",
		CreatedAt: createdAt,
	}
	require.NoError(t, cs.CreateMessage(ctx, message))

	return *message
}
