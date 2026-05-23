package whiteboard_test

import (
	whiteboardDB "backend/db/whiteboard"
	"backend/testutils"
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
)

// makeOp builds a pending op with sensible defaults for fold-matrix tests.
func makeOp(
	projectID, elementID, wbID uuid.UUID,
	op whiteboardDB.PendingElementOperationType,
) whiteboardDB.PendingElementOperation {
	return whiteboardDB.PendingElementOperation{
		ProjectID:    projectID,
		ElementID:    elementID,
		WhiteboardID: wbID,
		Operation:    op,
	}
}

// TestFold_NoExisting_StoresIncoming verifies the empty-cell branches of the
// fold matrix: any first op of a kind is stored as-is.
func TestFold_NoExisting_StoresIncoming(t *testing.T) {
	store := whiteboardDB.NewPendingElementStore(rdb)
	projectID := uuid.New()
	wbID := uuid.New()
	ctx := context.Background()

	for _, kind := range []whiteboardDB.PendingElementOperationType{
		whiteboardDB.PendingElementCreate,
		whiteboardDB.PendingElementUpdate,
		whiteboardDB.PendingElementDelete,
	} {
		t.Run(string(kind), func(t *testing.T) {
			elementID := uuid.New()
			testutils.RunRedisTestTransaction(t, rdb, keysForProject(projectID), func() {
				op := makeOp(projectID, elementID, wbID, kind)
				stored, collapsed, err := store.FoldPendingElementOperation(ctx, op)
				require.NoError(t, err)
				require.False(t, collapsed)
				require.NotNil(t, stored)
				assert.Equal(t, kind, stored.Operation)
				assert.False(t, stored.UpdatedAt.IsZero(), "fold must stamp UpdatedAt when zero")
			})
		})
	}
}

// TestFold_CreateThenDelete_CollapsesAndCleansHash verifies the most subtle
// fold rule: an element that is created then deleted before flush must leave
// no trace in Redis (including the project index entry).
func TestFold_CreateThenDelete_CollapsesAndCleansHash(t *testing.T) {
	store := whiteboardDB.NewPendingElementStore(rdb)
	projectID := uuid.New()
	elementID := uuid.New()
	wbID := uuid.New()
	ctx := context.Background()

	testutils.RunRedisTestTransaction(t, rdb, keysForProject(projectID), func() {
		create := makeOp(projectID, elementID, wbID, whiteboardDB.PendingElementCreate)
		create.ElementType = "rect"
		create.Props = datatypes.JSON([]byte(`{"id":"x"}`))
		_, collapsed, err := store.FoldPendingElementOperation(ctx, create)
		require.NoError(t, err)
		require.False(t, collapsed)

		del := makeOp(projectID, elementID, wbID, whiteboardDB.PendingElementDelete)
		stored, collapsed, err := store.FoldPendingElementOperation(ctx, del)
		require.NoError(t, err)
		assert.True(t, collapsed, "create+delete must collapse to no-op")
		assert.Nil(t, stored)

		// All per-project keys gone, project removed from pending index.
		exists, err := rdb.Exists(ctx,
			pendingElementsKey(projectID),
			pendingFlushAtKey(projectID),
			pendingFirstAtKey(projectID),
		).Result()
		require.NoError(t, err)
		assert.Zero(t, exists, "collapse must clean per-project keys")

		isMember, err := rdb.SIsMember(ctx, pendingProjectsSetKey, projectID.String()).Result()
		require.NoError(t, err)
		assert.False(t, isMember, "collapsed project must be removed from pending index")
	})
}

// TestFold_CreateThenUpdate_OverlaysFields verifies that a follow-up update
// merges into the existing create op (kind stays "create") and overlays only
// non-empty fields, including ZIndex=0 via *int.
func TestFold_CreateThenUpdate_OverlaysFields(t *testing.T) {
	store := whiteboardDB.NewPendingElementStore(rdb)
	projectID := uuid.New()
	elementID := uuid.New()
	wbID := uuid.New()
	creator := uuid.New()
	ctx := context.Background()

	testutils.RunRedisTestTransaction(t, rdb, keysForProject(projectID), func() {
		create := makeOp(projectID, elementID, wbID, whiteboardDB.PendingElementCreate)
		create.CreatedBy = &creator
		create.ElementType = "rect"
		create.Props = datatypes.JSON([]byte(`{"id":"x","x":1}`))
		create.ZIndex = zPtr(5)
		create.OperationID = "op-1"
		_, _, err := store.FoldPendingElementOperation(ctx, create)
		require.NoError(t, err)

		// Update: change props + set ZIndex=0; do NOT send ElementType.
		upd := makeOp(projectID, elementID, wbID, whiteboardDB.PendingElementUpdate)
		upd.Props = datatypes.JSON([]byte(`{"id":"x","x":42}`))
		upd.ZIndex = zPtr(0)
		upd.OperationID = "op-2"

		stored, collapsed, err := store.FoldPendingElementOperation(ctx, upd)
		require.NoError(t, err)
		require.False(t, collapsed)
		require.NotNil(t, stored)

		assert.Equal(t, whiteboardDB.PendingElementCreate, stored.Operation, "fold must keep create as the terminal op kind")
		assert.Equal(t, "rect", stored.ElementType, "ElementType must be preserved from create when update is empty")
		assert.JSONEq(t, `{"id":"x","x":42}`, string(stored.Props))
		require.NotNil(t, stored.ZIndex)
		assert.Equal(t, 0, *stored.ZIndex, "ZIndex=0 must overlay successfully (pointer semantics)")
		require.NotNil(t, stored.CreatedBy)
		assert.Equal(t, creator, *stored.CreatedBy, "CreatedBy from original create must survive")
		assert.Equal(t, "op-2", stored.OperationID, "latest OperationID wins")
	})
}

// TestFold_UpdateThenDelete_BecomesDelete verifies the rule that a delete on
// top of a pending update replaces the entry with delete while preserving
// WhiteboardID and CreatedBy so the flush worker / rollback have full context.
func TestFold_UpdateThenDelete_BecomesDelete(t *testing.T) {
	store := whiteboardDB.NewPendingElementStore(rdb)
	projectID := uuid.New()
	elementID := uuid.New()
	wbID := uuid.New()
	creator := uuid.New()
	ctx := context.Background()

	testutils.RunRedisTestTransaction(t, rdb, keysForProject(projectID), func() {
		upd := makeOp(projectID, elementID, wbID, whiteboardDB.PendingElementUpdate)
		upd.CreatedBy = &creator
		upd.Props = datatypes.JSON([]byte(`{"id":"x"}`))
		_, _, err := store.FoldPendingElementOperation(ctx, upd)
		require.NoError(t, err)

		// Delete carries no WhiteboardID/CreatedBy; fold must inherit them.
		del := makeOp(projectID, elementID, uuid.Nil, whiteboardDB.PendingElementDelete)
		stored, collapsed, err := store.FoldPendingElementOperation(ctx, del)
		require.NoError(t, err)
		require.False(t, collapsed)
		require.NotNil(t, stored)

		assert.Equal(t, whiteboardDB.PendingElementDelete, stored.Operation)
		assert.Equal(t, wbID, stored.WhiteboardID, "WhiteboardID must be inherited from prior update")
		require.NotNil(t, stored.CreatedBy)
		assert.Equal(t, creator, *stored.CreatedBy, "CreatedBy must be inherited from prior update")
	})
}

// TestFold_DeleteThenUpdate_KeepsDelete covers that updates on already-deleted
// pending elements are no-ops (delete still wins).
func TestFold_DeleteThenUpdate_KeepsDelete(t *testing.T) {
	store := whiteboardDB.NewPendingElementStore(rdb)
	projectID := uuid.New()
	elementID := uuid.New()
	wbID := uuid.New()
	ctx := context.Background()

	testutils.RunRedisTestTransaction(t, rdb, keysForProject(projectID), func() {
		_, _, err := store.FoldPendingElementOperation(ctx,
			makeOp(projectID, elementID, wbID, whiteboardDB.PendingElementDelete))
		require.NoError(t, err)

		upd := makeOp(projectID, elementID, wbID, whiteboardDB.PendingElementUpdate)
		upd.Props = datatypes.JSON([]byte(`{"id":"ignored"}`))
		stored, collapsed, err := store.FoldPendingElementOperation(ctx, upd)
		require.NoError(t, err)
		require.False(t, collapsed)
		require.NotNil(t, stored)
		assert.Equal(t, whiteboardDB.PendingElementDelete, stored.Operation,
			"update on a deleted element must be a no-op")
	})
}
