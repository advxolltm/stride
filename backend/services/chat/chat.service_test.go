package chat_test

import (
	chatStore "backend/db/chat"
	"backend/models"
	chatService "backend/services/chat"
	"backend/testutils"
	"context"
	"fmt"
	"testing"
	"time"

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

		del_msg, del_err := cs.GetMessage(ctx, msg.ID)
		require.NoError(t, del_err)
		assert.Equal(t, del_msg.DeletedAt.Second(), time.Now().Second())
		assert.True(t, del_msg.IsDeleted)
		assert.Empty(t, del_msg.Content)
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
}
