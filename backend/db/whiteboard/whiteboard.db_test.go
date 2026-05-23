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

		wb := &models.Whiteboard{
			ProjectID: project.ID,
		}
		err := store.CreateWhiteboard(ctx, wb)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, wb.ID)

		fetched, err := store.GetWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)
		assert.Equal(t, wb.ID, fetched.ID)
		assert.Equal(t, project.ID, fetched.ProjectID)
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

// TestWhiteboardStore_ElementProjectScoping locks down the critical
// authorization invariant: every element mutation MUST be scoped to the
// caller's project. A leak here would let users in project B mutate or
// delete elements in project A by guessing IDs.
func TestWhiteboardStore_ElementProjectScoping(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "GetElements only returns elements from the requested project", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		projects := testutils.SelectRandomProjects(t, db, 2)
		require.Len(t, projects, 2)
		projA, projB := projects[0], projects[1]

		wbA := &models.Whiteboard{ProjectID: projA.ID}
		require.NoError(t, store.CreateWhiteboard(ctx, wbA))
		wbB := &models.Whiteboard{ProjectID: projB.ID}
		require.NoError(t, store.CreateWhiteboard(ctx, wbB))

		_, err := store.CreateElement(ctx, &models.WhiteboardElement{
			WhiteboardID: wbA.ID, ElementType: "a-only",
			Props: datatypes.JSON([]byte(`{}`)),
		})
		require.NoError(t, err)
		_, err = store.CreateElement(ctx, &models.WhiteboardElement{
			WhiteboardID: wbB.ID, ElementType: "b-only",
			Props: datatypes.JSON([]byte(`{}`)),
		})
		require.NoError(t, err)

		gotA, err := store.GetElements(ctx, projA.ID)
		require.NoError(t, err)
		require.Len(t, gotA, 1)
		assert.Equal(t, "a-only", gotA[0].ElementType)

		gotB, err := store.GetElements(ctx, projB.ID)
		require.NoError(t, err)
		require.Len(t, gotB, 1)
		assert.Equal(t, "b-only", gotB[0].ElementType)
	})

	runTest(t, db, "UpdateElement with wrong project ID is rejected and leaves data untouched", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		projects := testutils.SelectRandomProjects(t, db, 2)
		require.Len(t, projects, 2)
		owner, attacker := projects[0], projects[1]

		wb := &models.Whiteboard{ProjectID: owner.ID}
		require.NoError(t, store.CreateWhiteboard(ctx, wb))
		element := &models.WhiteboardElement{
			WhiteboardID: wb.ID, ElementType: "rectangle",
			Props: datatypes.JSON([]byte(`{"original":true}`)),
		}
		_, err := store.CreateElement(ctx, element)
		require.NoError(t, err)

		hijack := "ellipse"
		hijackProps := datatypes.JSON([]byte(`{"original":false}`))
		_, err = store.UpdateElement(ctx, attacker.ID, element.ID, whiteboard.UpdateElementFields{
			ElementType: &hijack,
			Props:       &hijackProps,
		})
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound,
			"update from a foreign project must fail with not-found, not silently succeed")

		actual, err := store.GetElement(ctx, owner.ID, element.ID)
		require.NoError(t, err)
		assert.Equal(t, "rectangle", actual.ElementType, "type must not be modified by foreign update")
		assert.JSONEq(t, `{"original":true}`, string(actual.Props), "props must not be modified by foreign update")
	})

	runTest(t, db, "DeleteElement with wrong project ID is rejected and leaves data intact", func(t *testing.T, db *gorm.DB, store whiteboard.WhiteboardStore) {
		projects := testutils.SelectRandomProjects(t, db, 2)
		require.Len(t, projects, 2)
		owner, attacker := projects[0], projects[1]

		wb := &models.Whiteboard{ProjectID: owner.ID}
		require.NoError(t, store.CreateWhiteboard(ctx, wb))
		element := &models.WhiteboardElement{
			WhiteboardID: wb.ID, ElementType: "rectangle",
			Props: datatypes.JSON([]byte(`{}`)),
		}
		_, err := store.CreateElement(ctx, element)
		require.NoError(t, err)

		err = store.DeleteElement(ctx, attacker.ID, element.ID)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)

		_, err = store.GetElement(ctx, owner.ID, element.ID)
		assert.NoError(t, err, "element must still exist after foreign delete")
	})
}
