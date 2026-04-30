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
	return whiteboardSvc.NewWhiteboardService(wbStore, pService)
}

func ctxWithUser(userID uuid.UUID) context.Context {
	return context.WithValue(context.Background(), "userID", userID)
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
		db.Transaction(func(tx *gorm.DB) error {
			f(t, tx, newTestService(tx))
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}
func TestWhiteboardService_GetOrCreate_CreatesNewWhiteboard(t *testing.T) {
	runTest(t, db, "creates whiteboard when none exists", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := ctxWithUser(member.ID)

		wb, err := svc.GetOrCreateWhiteboardByProjectID(ctx, project.ID)

		require.NoError(t, err)
		require.NotNil(t, wb)
		assert.NotEqual(t, uuid.Nil, wb.ID)
		assert.Equal(t, project.ID, wb.ProjectID)
	})
}

func TestWhiteboardService_GetOrCreate_IsIdempotent(t *testing.T) {
	runTest(t, db, "returns existing whiteboard on second call", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := ctxWithUser(member.ID)

		first, err := svc.GetOrCreateWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)

		second, err := svc.GetOrCreateWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)

		assert.Equal(t, first.ID, second.ID, "second call must return the same whiteboard")
	})
}

func TestWhiteboardService_CreateElement_SetsWhiteboardID(t *testing.T) {
	runTest(t, db, "element receives WhiteboardID resolved from project", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := ctxWithUser(member.ID)

		wb, err := svc.GetOrCreateWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)

		element := &models.WhiteboardElement{
			ElementType: "rectangle",
			Props:       datatypes.JSON([]byte(`{"x": 10, "y": 20, "width": 100, "height": 50}`)),
		}

		created, err := svc.CreateElement(ctx, project.ID, element)

		require.NoError(t, err)
		require.NotNil(t, created)
		assert.Equal(t, wb.ID, created.WhiteboardID, "service must set WhiteboardID from the project's whiteboard")
		assert.NotEqual(t, uuid.Nil, created.ID)
	})
}

func TestWhiteboardService_CreateElement_FailsWhenNoWhiteboardExists(t *testing.T) {
	runTest(t, db, "error when project has no whiteboard", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := ctxWithUser(member.ID)

		element := &models.WhiteboardElement{
			ElementType: "sticky-note",
			Props:       datatypes.JSON([]byte(`{"text": "hello"}`)),
		}

		_, err := svc.CreateElement(ctx, project.ID, element)

		assert.Error(t, err)
	})
}

func TestWhiteboardService_NilUserID_ReturnsError(t *testing.T) {
	nilCtx := ctxWithUser(uuid.Nil)
	projectID := uuid.New()
	elementID := uuid.New()

	cases := []struct {
		name string
		fn   func(whiteboardSvc.WhiteboardService) error
	}{
		{
			name: "GetOrCreateWhiteboardByProjectID",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.GetOrCreateWhiteboardByProjectID(nilCtx, projectID)
				return err
			},
		},
		{
			name: "GetElements",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.GetElements(nilCtx, projectID)
				return err
			},
		},
		{
			name: "GetElement",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.GetElement(nilCtx, projectID, elementID)
				return err
			},
		},
		{
			name: "CreateElement",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.CreateElement(nilCtx, projectID, &models.WhiteboardElement{ElementType: "rect"})
				return err
			},
		},
		{
			name: "UpdateElement",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				_, err := svc.UpdateElement(nilCtx, projectID, elementID, whiteboardDB.UpdateElementFields{})
				return err
			},
		},
		{
			name: "DeleteElement",
			fn: func(svc whiteboardSvc.WhiteboardService) error {
				return svc.DeleteElement(nilCtx, projectID, elementID)
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
		ctx := ctxWithUser(member.ID)

		_, err := svc.GetOrCreateWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)

		elements, err := svc.GetElements(ctx, project.ID)

		require.NoError(t, err)
		assert.Empty(t, elements)
	})
}

func TestWhiteboardService_GetElement_ReturnsSameElement(t *testing.T) {
	runTest(t, db, "GetElement returns the element just created", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := ctxWithUser(member.ID)

		_, err := svc.GetOrCreateWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)

		created, err := svc.CreateElement(ctx, project.ID, &models.WhiteboardElement{
			ElementType: "ellipse",
			Props:       datatypes.JSON([]byte(`{"rx": 50}`)),
		})
		require.NoError(t, err)

		fetched, err := svc.GetElement(ctx, project.ID, created.ID)

		require.NoError(t, err)
		assert.Equal(t, created.ID, fetched.ID)
		assert.Equal(t, "ellipse", fetched.ElementType)
	})
}

func TestWhiteboardService_DeleteElement_RemovesElement(t *testing.T) {
	runTest(t, db, "element not found after deletion", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member := selectProjectMember(t, db)
		ctx := ctxWithUser(member.ID)

		_, err := svc.GetOrCreateWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)

		created, err := svc.CreateElement(ctx, project.ID, &models.WhiteboardElement{
			ElementType: "text",
			Props:       datatypes.JSON([]byte(`{"content": "hello"}`)),
		})
		require.NoError(t, err)

		err = svc.DeleteElement(ctx, project.ID, created.ID)
		require.NoError(t, err)

		_, err = svc.GetElement(ctx, project.ID, created.ID)
		assert.Error(t, err)
	})
}
