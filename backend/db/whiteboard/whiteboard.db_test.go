package whiteboard_test

import (
	"backend/db/whiteboard"
	"backend/models"
	"backend/testutils"
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

func runTest(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, whiteboard.WhiteboardStore)) {
	t.Run(name, func(t *testing.T) {
		_ = db.Transaction(func(tx *gorm.DB) error {
			f(t, tx, whiteboard.NewWhiteboardStore(tx))
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}

func TestWhiteboardStore_CreateAndGet(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "Create whiteboard and get by project ID", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		project := testutils.SelectRandomProject(t, db)
		canvasState := datatypes.JSON([]byte(`{"appState":{"viewBackgroundColor":"#ffffff"}}`))

		wb := &models.Whiteboard{
			ProjectID:   project.ID,
			CanvasState: canvasState,
		}
		err := store.CreateWhiteboard(ctx, wb)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, wb.ID)

		fetched, err := store.GetWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)
		assert.Equal(t, wb.ID, fetched.ID)
		assert.Equal(t, project.ID, fetched.ProjectID)
		assert.JSONEq(t, string(canvasState), string(fetched.CanvasState))
	})

	runTest(t, db, "Update whiteboard canvas state", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		project := testutils.SelectRandomProject(t, db)

		wb := &models.Whiteboard{ProjectID: project.ID}
		err := store.CreateWhiteboard(ctx, wb)
		require.NoError(t, err)

		updatedState := datatypes.JSON([]byte(`{"files":{"asset-1":{"id":"asset-1"}}}`))
		updated, err := store.UpdateCanvasState(ctx, project.ID, updatedState)
		require.NoError(t, err)
		assert.JSONEq(t, string(updatedState), string(updated.CanvasState))
	})

	runTest(t, db, "Get non-existent whiteboard returns error", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		_, err := store.GetWhiteboardByProjectID(ctx, uuid.New())
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}

func TestWhiteboardStore_Elements(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "Create element and list elements", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		project := testutils.SelectRandomProject(t, db)
		user := testutils.SelectRandomUser(t, db)

		wb := &models.Whiteboard{
			ProjectID: project.ID,
		}
		err := store.CreateWhiteboard(ctx, wb)
		require.NoError(t, err)

		element := &models.WhiteboardElement{
			WhiteboardID: wb.ID,
			CreatedBy:    &user.ID,
			ElementType:  "rectangle",
			Props:        datatypes.JSON([]byte(`{"x": 0, "y": 0, "width": 100, "height": 50}`)),
		}
		_, err = store.CreateElement(ctx, element)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, element.ID)

		elements, err := store.GetElements(ctx, project.ID)
		require.NoError(t, err)
		assert.Len(t, elements, 1)
		assert.Equal(t, "rectangle", elements[0].ElementType)
	})

	runTest(t, db, "Update element", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		project := testutils.SelectRandomProject(t, db)

		wb := &models.Whiteboard{
			ProjectID: project.ID,
		}
		err := store.CreateWhiteboard(ctx, wb)
		require.NoError(t, err)

		element := &models.WhiteboardElement{
			WhiteboardID: wb.ID,
			ElementType:  "rectangle",
			Props:        datatypes.JSON([]byte(`{"x": 0}`)),
		}
		_, err = store.CreateElement(ctx, element)
		require.NoError(t, err)

		newType := "ellipse"
		newProps := datatypes.JSON([]byte(`{"x": 10, "y": 20}`))
		updated, err := store.UpdateElement(ctx, project.ID, element.ID, whiteboard.UpdateElementFields{
			ElementType: &newType,
			Props:       &newProps,
		})
		require.NoError(t, err)
		assert.Equal(t, "ellipse", updated.ElementType)
	})

	runTest(t, db, "Delete element", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		project := testutils.SelectRandomProject(t, db)

		wb := &models.Whiteboard{
			ProjectID: project.ID,
		}
		err := store.CreateWhiteboard(ctx, wb)
		require.NoError(t, err)

		element := &models.WhiteboardElement{
			WhiteboardID: wb.ID,
			ElementType:  "sticky-note",
			Props:        datatypes.JSON([]byte(`{"text": "hello"}`)),
		}
		_, err = store.CreateElement(ctx, element)
		require.NoError(t, err)

		err = store.DeleteElement(ctx, project.ID, element.ID)
		require.NoError(t, err)

		_, err = store.GetElement(ctx, project.ID, element.ID)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})

	runTest(t, db, "Delete non-existent element returns error", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		err := store.DeleteElement(ctx, uuid.New(), uuid.New())
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}
