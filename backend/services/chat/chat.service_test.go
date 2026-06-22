package chat_test

import (
	chatStore "backend/db/chat"
	"backend/models"
	chatService "backend/services/chat"
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

func newTestChatService(db *gorm.DB) chatService.ChatService {
	return chatService.NewChatService(chatStore.NewChatStore(db))
}

func runTest(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, chatService.ChatService)) {
	t.Run(name, func(t *testing.T) {
		_ = db.Transaction(func(tx *gorm.DB) error {
			f(t, tx, newTestChatService(tx))
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}

func TestChatStore(t *testing.T) {
	ctx := context.Background()
	content := "Hello, World!"

	runTest(t, db, "CreateMessage expected behaviour", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)
		msg, create_err := cs.CreateMessage(ctx, content, proj.Members[0])
		require.NoError(t, create_err)
		var gotMsg models.Message
		get_err := db.First(&gotMsg, "id = ?", msg.ID)
		require.NoError(t, get_err.Error)
		assert.Equal(t, content, gotMsg.Content)
	})

	runTest(t, db, "GetMessage expected behaviour", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)
		createdMsg, err := cs.CreateMessage(ctx, content, proj.Members[0])
		require.NoError(t, err)

		fetchedMsg, err := cs.GetMessage(ctx, createdMsg.ID)
		require.NoError(t, err)
		assert.Equal(t, createdMsg.ID, fetchedMsg.ID)
		assert.Equal(t, content, fetchedMsg.Content)
	})

	runTest(t, db, "UpdateMessage expected behaviour", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)
		msg, err := cs.CreateMessage(ctx, content, proj.Members[0])
		require.NoError(t, err)

		updatedContent := "Bleep Bloop"
		updatedMsg, err := cs.UpdateMessage(ctx, msg.ID, updatedContent)
		require.NoError(t, err)
		assert.Equal(t, updatedContent, updatedMsg.Content)

		var gotMsg models.Message
		err = db.First(&gotMsg, "id = ?", msg.ID).Error
		require.NoError(t, err)
		assert.Equal(t, updatedContent, gotMsg.Content)
		assert.Equal(t, gotMsg.EditedAt.Second(), time.Now().Second())
	})

	runTest(t, db, "DeleteMessage expected behaviour", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)
		msg, err := cs.CreateMessage(ctx, content, proj.Members[0])
		require.NoError(t, err)

		err = cs.DeleteMessage(ctx, msg.ID)
		require.NoError(t, err)

		_, delErr := cs.GetMessage(ctx, msg.ID)
		require.Error(t, delErr)
		assert.True(t, errors.Is(delErr, chatService.ErrMessageNotFound))
	})

	runTest(t, db, "GetMessageCount expected behaviour", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)

		initialCount, err := cs.GetMessageCount(ctx, proj.ID)
		require.NoError(t, err)

		for i := 0; i < 3; i++ {
			_, err := cs.CreateMessage(ctx, fmt.Sprintf("hi %d", i), proj.Members[0])
			require.NoError(t, err)
		}

		newCount, err := cs.GetMessageCount(ctx, proj.ID)
		require.NoError(t, err)
		assert.Equal(t, initialCount+3, newCount)
	})

	runTest(t, db, "GetProjectMessages expected behaviour", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)

		var createdMessages []models.Message
		for i := 0; i < 3; i++ {
			msg, err := cs.CreateMessage(ctx, fmt.Sprintf("Paginated Bleep Bloop %d", i), proj.Members[0])
			require.NoError(t, err)
			createdMessages = append(createdMessages, msg)
		}

		page := 0
		pageSize := 10
		paginatedResult, err := cs.GetProjectMessages(ctx, proj.ID, page, pageSize)
		require.NoError(t, err)

		assert.NotNil(t, paginatedResult.Items)
		assert.GreaterOrEqual(t, len(paginatedResult.Items), 3)

		found := false
		for _, item := range paginatedResult.Items {
			if item.ID == createdMessages[0].ID {
				found = true
				break
			}
		}
		assert.True(t, found, "Expected newly created message to be in the paginated results")
	})
	runTest(t, db, "MarkDelivered returns created cursor", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)
		msg, err := cs.CreateMessage(ctx, content, proj.Members[0])
		require.NoError(t, err)
		projectID := proj.ID
		projectMemberID := proj.Members[1].ID
		messageID := msg.ID

		cursor, err := cs.MarkDelivered(ctx, projectID, projectMemberID, messageID)

		require.NoError(t, err)
		assert.Equal(t, projectID, cursor.ProjectID)
		assert.Equal(t, projectMemberID, cursor.ProjectMemberID)
		assert.Equal(t, messageID, cursor.LastDeliveredMessageID)
		assert.Equal(t, proj.ID, projectID)
		assert.Equal(t, proj.Members[1].ID, projectMemberID)
		assert.Equal(t, msg.ID, messageID)
	})
	runTest(t, db, "MarkRead returns created cursor", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)
		msg, err := cs.CreateMessage(ctx, content, proj.Members[0])
		require.NoError(t, err)

		cursor, err := cs.MarkRead(ctx, proj.ID, proj.Members[1].ID, msg.ID)

		require.NoError(t, err)
		require.NotNil(t, cursor.LastReadMessageID)
		assert.Equal(t, msg.ID, *cursor.LastReadMessageID)
		assert.Equal(t, msg.ID, cursor.LastDeliveredMessageID)
	})
	runTest(t, db, "GetProjectChatCursors returns project cursors", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)
		msg, err := cs.CreateMessage(ctx, content, proj.Members[0])
		require.NoError(t, err)
		_, err = cs.MarkDelivered(ctx, proj.ID, proj.Members[1].ID, msg.ID)
		require.NoError(t, err)

		cursors, err := cs.GetProjectChatCursors(ctx, proj.ID)

		require.NoError(t, err)
		require.NotEmpty(t, cursors)
	})
	runTest(t, db, "MarkRead preserves ErrMessageNotFound", func(t *testing.T, db *gorm.DB, cs chatService.ChatService) {
		proj := testutils.SelectRandomProject(t, db)

		_, err := cs.MarkRead(ctx, proj.ID, proj.Members[0].ID, uuid.New())

		require.Error(t, err)
		assert.True(t, errors.Is(err, chatService.ErrMessageNotFound))
	})
}
