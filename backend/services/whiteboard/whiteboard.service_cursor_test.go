package whiteboard_test

import (
	whiteboardSvc "backend/services/whiteboard"
	"backend/testutils"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testCursorPresenceKey(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:cursor:presence:%s", projectID)
}

func floatPtr(value float64) *float64 {
	return &value
}

func TestCursorPresenceStore_SnapshotPrunesStaleRecords(t *testing.T) {
	ctx := t.Context()
	projectID := uuid.New()
	key := testCursorPresenceKey(projectID)

	testutils.RunRedisTestTransaction(t, rdb, []string{key}, func() {
		store := whiteboardSvc.NewCursorPresenceStore(rdb)
		staleRecord := whiteboardSvc.CursorPresenceRecord{
			ConnectionID: "stale-connection",
			User: whiteboardSvc.CursorUser{
				ID:   "stale-user",
				Name: "Stale User",
			},
			Cursor: whiteboardSvc.CursorPosition{
				X: floatPtr(10),
				Y: floatPtr(20),
			},
			UpdatedAt: time.Now().UTC().Add(-whiteboardSvc.CursorPresenceMaxAge - time.Second),
		}
		liveRecord := whiteboardSvc.CursorPresenceRecord{
			ConnectionID: "live-connection",
			User: whiteboardSvc.CursorUser{
				ID:   "live-user",
				Name: "Live User",
			},
			Cursor: whiteboardSvc.CursorPosition{
				X: floatPtr(30),
				Y: floatPtr(40),
			},
			UpdatedAt: time.Now().UTC(),
		}

		require.NoError(t, store.PutConnection(ctx, projectID, staleRecord))
		require.NoError(t, store.PutConnection(ctx, projectID, liveRecord))

		snapshot, err := store.Snapshot(ctx, projectID)
		require.NoError(t, err)
		require.Len(t, snapshot, 1)
		assert.Equal(t, "live-user", snapshot[0].User.ID)

		staleExists, err := rdb.HExists(ctx, key, staleRecord.ConnectionID).Result()
		require.NoError(t, err)
		assert.False(t, staleExists)

		liveExists, err := rdb.HExists(ctx, key, liveRecord.ConnectionID).Result()
		require.NoError(t, err)
		assert.True(t, liveExists)
	})
}

func TestCursorPresenceStore_SnapshotKeepsLatestLiveConnectionPerUser(t *testing.T) {
	ctx := t.Context()
	projectID := uuid.New()
	key := testCursorPresenceKey(projectID)

	testutils.RunRedisTestTransaction(t, rdb, []string{key}, func() {
		store := whiteboardSvc.NewCursorPresenceStore(rdb)
		user := whiteboardSvc.CursorUser{
			ID:   "same-user",
			Name: "Same User",
		}
		olderRecord := whiteboardSvc.CursorPresenceRecord{
			ConnectionID: "older-connection",
			User:         user,
			Cursor: whiteboardSvc.CursorPosition{
				X: floatPtr(10),
				Y: floatPtr(20),
			},
			UpdatedAt: time.Now().UTC().Add(-10 * time.Second),
		}
		newerRecord := whiteboardSvc.CursorPresenceRecord{
			ConnectionID: "newer-connection",
			User:         user,
			Cursor: whiteboardSvc.CursorPosition{
				X: floatPtr(30),
				Y: floatPtr(40),
			},
			UpdatedAt: time.Now().UTC(),
		}

		require.NoError(t, store.PutConnection(ctx, projectID, olderRecord))
		require.NoError(t, store.PutConnection(ctx, projectID, newerRecord))

		snapshot, err := store.Snapshot(ctx, projectID)
		require.NoError(t, err)
		require.Len(t, snapshot, 1)
		require.NotNil(t, snapshot[0].Cursor.X)
		require.NotNil(t, snapshot[0].Cursor.Y)
		assert.Equal(t, 30.0, *snapshot[0].Cursor.X)
		assert.Equal(t, 40.0, *snapshot[0].Cursor.Y)

		fieldCount, err := rdb.HLen(ctx, key).Result()
		require.NoError(t, err)
		assert.Equal(t, int64(2), fieldCount)
	})
}
