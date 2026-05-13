package chat_test

import (
	"backend/db/chat"
	"backend/models"
	"backend/testutils"
	"context"
	"fmt"
	"testing"

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
		get_err := db.First(&msg, "id = ?", message.ID)
		require.NoError(t, get_err.Error)
		assert.True(t, msg.IsDeleted)
		assert.Equal(t, "", msg.Content)
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
}
