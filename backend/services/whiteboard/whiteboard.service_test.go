package whiteboard_test

import (
	projectDB "backend/db/project"
	whiteboardDB "backend/db/whiteboard"
	"backend/models"
	projectSvc "backend/services/project"
	whiteboardSvc "backend/services/whiteboard"
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

func newTestService(db *gorm.DB) whiteboardSvc.WhiteboardService {
	wbStore := whiteboardDB.NewWhiteboardStore(db)
	pStore := projectDB.NewProjectStore(db)
	pService := projectSvc.NewProjectService(pStore)
	return whiteboardSvc.NewWhiteboardService(wbStore, pService, whiteboardDB.NewPendingElementStore(rdb))
}

func selectProjectMember(t *testing.T, db *gorm.DB) (models.Project, models.User) {
	t.Helper()
	var pm models.ProjectMember
	err := db.Preload("Project").Preload("User").First(&pm).Error
	require.NoError(t, err)
	return pm.Project, pm.User
}

func runTest(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, whiteboardSvc.WhiteboardService)) {
	t.Run(name, func(t *testing.T) {
		_ = db.Transaction(func(tx *gorm.DB) error {
			f(t, tx, newTestService(tx))
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}
func TestWhiteboardService_GetOrCreate_CreatesNewWhiteboard(t *testing.T) {
	runTest(t, db, "creates whiteboard when none exists", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := context.Background()

		wb, err := svc.GetOrCreateWhiteboardByProjectID(ctx, member.ID, project.ID)

		require.NoError(t, err)
		require.NotNil(t, wb)
		assert.NotEqual(t, uuid.Nil, wb.ID)
		assert.Equal(t, project.ID, wb.ProjectID)
	})
}

func TestWhiteboardService_GetOrCreate_IsIdempotent(t *testing.T) {
	runTest(t, db, "returns existing whiteboard on second call", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := context.Background()

		first, err := svc.GetOrCreateWhiteboardByProjectID(ctx, member.ID, project.ID)
		require.NoError(t, err)

		second, err := svc.GetOrCreateWhiteboardByProjectID(ctx, member.ID, project.ID)
		require.NoError(t, err)

		assert.Equal(t, first.ID, second.ID, "second call must return the same whiteboard")
	})
}

func TestWhiteboardService_CreateElement_SetsWhiteboardID(t *testing.T) {
	runTest(t, db, "element receives WhiteboardID resolved from project", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := context.Background()

		wb, err := svc.GetOrCreateWhiteboardByProjectID(ctx, member.ID, project.ID)
		require.NoError(t, err)

		element := &models.WhiteboardElement{
			ElementType: "rectangle",
			Props:       datatypes.JSON([]byte(`{"x": 10, "y": 20, "width": 100, "height": 50}`)),
		}

		created, err := svc.CreateElement(ctx, member.ID, project.ID, element)

		require.NoError(t, err)
		require.NotNil(t, created)
		assert.Equal(t, wb.ID, created.WhiteboardID, "service must set WhiteboardID from the project's whiteboard")
		assert.NotEqual(t, uuid.Nil, created.ID)
	})
}

func TestWhiteboardService_CreateElement_CreatesWhiteboardWhenMissing(t *testing.T) {
	runTest(t, db, "create element auto-creates whiteboard when project has none", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := context.Background()

		element := &models.WhiteboardElement{
			ElementType: "sticky-note",
			Props:       datatypes.JSON([]byte(`{"text": "hello"}`)),
		}

		created, err := svc.CreateElement(ctx, member.ID, project.ID, element)

		require.NoError(t, err)
		require.NotNil(t, created)
		assert.NotEqual(t, uuid.Nil, created.WhiteboardID)

		wb, err := svc.GetWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)
		assert.Equal(t, wb.ID, created.WhiteboardID)
	})
}

func TestWhiteboardService_NilUserID_ReturnsError(t *testing.T) {
	ctx := context.Background()
	nilUserID := uuid.Nil
	projectID := uuid.New()
	elementID := uuid.New()

	cases := []struct {
		name string
		fn   func(whiteboardSvc.WhiteboardService) error
	}{
		{
			name: "GetOrCreateWhiteboardByProjectID",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.GetOrCreateWhiteboardByProjectID(ctx, nilUserID, projectID)
				return err
			},
		},
		{
			name: "GetElements",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.GetElements(ctx, nilUserID, projectID)
				return err
			},
		},
		{
			name: "GetElement",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.GetElement(ctx, nilUserID, projectID, elementID)
				return err
			},
		},
		{
			name: "CreateElement",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.CreateElement(ctx, nilUserID, projectID, &models.WhiteboardElement{ElementType: "rect"})
				return err
			},
		},
		{
			name: "UpdateElement",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.UpdateElement(ctx, nilUserID, projectID, elementID, whiteboardDB.UpdateElementFields{})
				return err
			},
		},
		{
			name: "DeleteElement",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				return svc.DeleteElement(ctx, nilUserID, projectID, elementID)
			},
		},
	}

	for _, tc := range cases {
		runTest(t, db, tc.name+" rejects nil userID", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
			err := tc.fn(svc)
			assert.Error(t, err, "expected error for nil userID")
		})
	}
}

func TestWhiteboardService_GetWhiteboardByProjectID_NotFound(t *testing.T) {
	runTest(t, db, "not found for unknown project", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		_, err := svc.GetWhiteboardByProjectID(context.Background(), uuid.New())

		assert.Error(t, err)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}

func TestWhiteboardService_GetElements_EmptyForFreshWhiteboard(t *testing.T) {
	runTest(t, db, "empty element list for fresh whiteboard", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := context.Background()

		_, err := svc.GetOrCreateWhiteboardByProjectID(ctx, member.ID, project.ID)
		require.NoError(t, err)

		elements, err := svc.GetElements(ctx, member.ID, project.ID)

		require.NoError(t, err)
		assert.Empty(t, elements)
	})
}

func TestWhiteboardService_GetElement_ReturnsSameElement(t *testing.T) {
	runTest(t, db, "GetElement returns the element just created", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := context.Background()

		_, err := svc.GetOrCreateWhiteboardByProjectID(ctx, member.ID, project.ID)
		require.NoError(t, err)

		created, err := svc.CreateElement(ctx, member.ID, project.ID, &models.WhiteboardElement{
			ElementType: "ellipse",
			Props:       datatypes.JSON([]byte(`{"rx": 50}`)),
		})
		require.NoError(t, err)

		fetched, err := svc.GetElement(ctx, member.ID, project.ID, created.ID)

		require.NoError(t, err)
		assert.Equal(t, created.ID, fetched.ID)
		assert.Equal(t, "ellipse", fetched.ElementType)
	})
}

func TestWhiteboardService_DeleteElement_RemovesElement(t *testing.T) {
	runTest(t, db, "element not found after deletion", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := context.Background()

		_, err := svc.GetOrCreateWhiteboardByProjectID(ctx, member.ID, project.ID)
		require.NoError(t, err)

		created, err := svc.CreateElement(ctx, member.ID, project.ID, &models.WhiteboardElement{
			ElementType: "text",
			Props:       datatypes.JSON([]byte(`{"content": "hello"}`)),
		})
		require.NoError(t, err)

		err = svc.DeleteElement(ctx, member.ID, project.ID, created.ID)
		require.NoError(t, err)

		_, err = svc.GetElement(ctx, member.ID, project.ID, created.ID)
		assert.Error(t, err)
	})
}

func pendingKeysFor(projectID uuid.UUID) []string {
	return []string{
		fmt.Sprintf("whiteboard:pending:%s:elements", projectID),
		fmt.Sprintf("whiteboard:pending:%s:flush_at", projectID),
		fmt.Sprintf("whiteboard:pending:%s:first_pending_at", projectID),
		"whiteboard:pending:projects",
	}
}

func zIdxPtr(v int) *int { return new(v) }

func TestWhiteboardService_GetElements_MergesPendingCreateUpdateDelete(t *testing.T) {
	runTest(t, db, "merge overlays pending ops on PostgreSQL elements", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := context.Background()

		wb, err := svc.GetOrCreateWhiteboardByProjectID(ctx, member.ID, project.ID)
		require.NoError(t, err)

		// Two persisted elements.
		persisted, err := svc.CreateElement(ctx, member.ID, project.ID, &models.WhiteboardElement{
			ElementType: "rect",
			Props:       datatypes.JSON([]byte(`{"id":"keep","x":1}`)),
			ZIndex:      0,
		})
		require.NoError(t, err)
		doomed, err := svc.CreateElement(ctx, member.ID, project.ID, &models.WhiteboardElement{
			ElementType: "rect",
			Props:       datatypes.JSON([]byte(`{"id":"doomed"}`)),
			ZIndex:      1,
		})
		require.NoError(t, err)

		pendingStore := whiteboardDB.NewPendingElementStore(rdb)
		testutils.RunRedisTestTransaction(t, rdb, pendingKeysFor(project.ID), func() {
			// Pending update to `persisted`, pending delete of `doomed`,
			// pending create of a new element `fresh`.
			freshID := uuid.New()
			ops := []whiteboardDB.PendingElementOperation{
				{
					ProjectID:    project.ID,
					ElementID:    persisted.ID,
					WhiteboardID: wb.ID,
					Operation:    whiteboardDB.PendingElementUpdate,
					Props:        datatypes.JSON([]byte(`{"id":"keep","x":42}`)),
					ZIndex:       zIdxPtr(5),
				},
				{
					ProjectID:    project.ID,
					ElementID:    doomed.ID,
					WhiteboardID: wb.ID,
					Operation:    whiteboardDB.PendingElementDelete,
				},
				{
					ProjectID:    project.ID,
					ElementID:    freshID,
					WhiteboardID: wb.ID,
					Operation:    whiteboardDB.PendingElementCreate,
					ElementType:  "ellipse",
					Props:        datatypes.JSON([]byte(`{"id":"fresh"}`)),
					ZIndex:       zIdxPtr(2),
				},
			}
			for _, op := range ops {
				require.NoError(t, pendingStore.PutPendingElementOperation(ctx, op))
			}

			merged, err := svc.GetElements(ctx, member.ID, project.ID)
			require.NoError(t, err)
			require.Len(t, merged, 2, "doomed deleted, fresh added, persisted updated")

			// Order: fresh (z=2) before persisted (z=5).
			assert.Equal(t, freshID, merged[0].ID)
			assert.Equal(t, "ellipse", merged[0].ElementType)
			assert.Equal(t, persisted.ID, merged[1].ID)
			assert.Equal(t, 5, merged[1].ZIndex, "ZIndex must reflect pending update")
			assert.JSONEq(t, `{"id":"keep","x":42}`, string(merged[1].Props))
		})
	})
}

func TestWhiteboardService_GetElements_NoPending_ReturnsDBOnly(t *testing.T) {
	runTest(t, db, "no pending ops -> raw DB result", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := context.Background()

		_, err := svc.GetOrCreateWhiteboardByProjectID(ctx, member.ID, project.ID)
		require.NoError(t, err)
		created, err := svc.CreateElement(ctx, member.ID, project.ID, &models.WhiteboardElement{
			ElementType: "rect",
			Props:       datatypes.JSON([]byte(`{"id":"only"}`)),
		})
		require.NoError(t, err)

		testutils.RunRedisTestTransaction(t, rdb, pendingKeysFor(project.ID), func() {
			got, err := svc.GetElements(ctx, member.ID, project.ID)
			require.NoError(t, err)
			require.Len(t, got, 1)
			assert.Equal(t, created.ID, got[0].ID)
		})
	})
}
