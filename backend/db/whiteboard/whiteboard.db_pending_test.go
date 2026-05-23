package whiteboard_test

import (
	whiteboardDB "backend/db/whiteboard"
	"backend/testutils"
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
)

const pendingProjectsSetKey = "whiteboard:pending:projects"

func pendingElementsKey(projectID uuid.UUID) string {
    return fmt.Sprintf("whiteboard:pending:%s:elements", projectID)
}

func pendingFlushAtKey(projectID uuid.UUID) string {
    return fmt.Sprintf("whiteboard:pending:%s:flush_at", projectID)
}

func pendingFirstAtKey(projectID uuid.UUID) string {
    return fmt.Sprintf("whiteboard:pending:%s:first_pending_at", projectID)
}

func keysForProject(projectID uuid.UUID) []string {
    return []string{
        pendingElementsKey(projectID),
        pendingFlushAtKey(projectID),
        pendingFirstAtKey(projectID),
        pendingProjectsSetKey,
    }
}

func zPtr(v int) *int { return &v }

func TestPendingElementStore_PutAndList(t *testing.T) {
    store := whiteboardDB.NewPendingElementStore(rdb)
    projectID := uuid.New()
    testutils.RunRedisTestTransaction(t, rdb, keysForProject(projectID), func() {
        ctx := context.Background()
        op := whiteboardDB.PendingElementOperation{
            ProjectID:    projectID,
            ElementID:    uuid.New(),
            WhiteboardID: uuid.New(),
            Operation:    whiteboardDB.PendingElementCreate,
            ElementType:  "rectangle",
            Props:        datatypes.JSON([]byte(`{"id":"shape-1"}`)),
            ZIndex:       zPtr(0),
            OperationID:  "op-1",
        }
        require.NoError(t, store.PutPendingElementOperation(ctx, op))

        got, err := store.ListPendingElementOperations(ctx, projectID)
        require.NoError(t, err)
        require.Len(t, got, 1)
        assert.Equal(t, op.ElementID, got[0].ElementID)
        require.NotNil(t, got[0].ZIndex)
        assert.Equal(t, 0, *got[0].ZIndex, "ZIndex=0 must survive round trip")
        assert.False(t, got[0].UpdatedAt.IsZero())

        projects, err := store.ListPendingProjects(ctx)
        require.NoError(t, err)
        assert.Contains(t, projects, projectID)
    })
}

func TestPendingElementStore_DeleteCollapsesEmptyHash(t *testing.T) {
    store := whiteboardDB.NewPendingElementStore(rdb)
    projectID := uuid.New()
    testutils.RunRedisTestTransaction(t, rdb, keysForProject(projectID), func() {
        ctx := context.Background()
        op := whiteboardDB.PendingElementOperation{ProjectID: projectID, ElementID: uuid.New(), Operation: whiteboardDB.PendingElementCreate}
        require.NoError(t, store.PutPendingElementOperation(ctx, op))
        require.NoError(t, store.MarkProjectPendingFlush(ctx, projectID, time.Now()))

        require.NoError(t, store.DeletePendingElementOperations(ctx, projectID, op.ElementID))

        exists, err := rdb.Exists(ctx, pendingElementsKey(projectID), pendingFlushAtKey(projectID)).Result()
        require.NoError(t, err)
        assert.Zero(t, exists, "hash + flush_at must be cleaned when no ops remain")

        isMember, err := rdb.SIsMember(ctx, pendingProjectsSetKey, projectID.String()).Result()
        require.NoError(t, err)
        assert.False(t, isMember)
    })
}

func TestPendingElementStore_MarkRespectsCeiling(t *testing.T) {
    store := whiteboardDB.NewPendingElementStore(rdb)
    projectID := uuid.New()
    testutils.RunRedisTestTransaction(t, rdb, keysForProject(projectID), func() {
        ctx := context.Background()
        start := time.Now().UTC().Truncate(time.Millisecond)
        require.NoError(t, store.MarkProjectPendingFlush(ctx, projectID, start))

        // Continuous editing: many marks 8s in -> ceiling at start+10s, not now+2s.
        later := start.Add(8 * time.Second)
        require.NoError(t, store.MarkProjectPendingFlush(ctx, projectID, later))

        flushAt, ok, err := store.ProjectFlushAt(ctx, projectID)
        require.NoError(t, err)
        require.True(t, ok)
        assert.True(t, flushAt.Equal(start.Add(whiteboardDB.PendingFlushMaxWait)),
            "flush_at must be clamped to first_pending_at + 10s, got %s", flushAt)
    })
}

// TestPendingElementStore_PartialDeleteKeepsCycleAndIndex ensures that
// deleting only some pending elements does NOT tear down the flush cycle:
// flush_at and the project's membership in the pending-projects index must
// remain so the flusher still runs for the leftover ops.
// TestPendingElementStore_ListPendingProjectsSelfHeals verifies the index
// auto-prunes garbage entries (e.g. from prior bugs / manual writes) and
// never breaks listing for healthy callers.
func TestPendingElementStore_ListPendingProjectsSelfHeals(t *testing.T) {
	store := whiteboardDB.NewPendingElementStore(rdb)
	good := uuid.New()
	testutils.RunRedisTestTransaction(t, rdb, append(keysForProject(good), pendingProjectsSetKey), func() {
		ctx := context.Background()
		require.NoError(t, store.PutPendingElementOperation(ctx, whiteboardDB.PendingElementOperation{
			ProjectID: good, ElementID: uuid.New(),
			Operation: whiteboardDB.PendingElementUpdate,
		}))
		require.NoError(t, rdb.SAdd(ctx, pendingProjectsSetKey, "not-a-uuid").Err())

		projects, err := store.ListPendingProjects(ctx)
		require.NoError(t, err)
		assert.Contains(t, projects, good)

		isMember, err := rdb.SIsMember(ctx, pendingProjectsSetKey, "not-a-uuid").Result()
		require.NoError(t, err)
		assert.False(t, isMember, "invalid index entries must be removed")
	})
}