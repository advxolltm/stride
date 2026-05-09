package whiteboard_test

import (
	"backend/models"
	whiteboardSvc "backend/services/whiteboard"
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func createSceneTestProject(t *testing.T, db *gorm.DB) (models.Project, models.User) {
	t.Helper()
	suffix := uuid.NewString()
	user := models.User{
		Username:     "whiteboard-scene-" + suffix,
		Email:        fmt.Sprintf("whiteboard-scene-%s@example.com", suffix),
		PasswordHash: "hash",
	}
	require.NoError(t, db.Create(&user).Error)

	project := models.Project{
		CreatedBy: &user.ID,
		Name:      "whiteboard scene " + suffix,
		Slug:      "whiteboard-scene-" + suffix,
		Status:    "active",
	}
	require.NoError(t, db.Create(&project).Error)

	member := models.ProjectMember{
		UserID:    user.ID,
		ProjectID: project.ID,
		Role:      "owner",
	}
	require.NoError(t, db.Create(&member).Error)

	return project, user
}

func sceneJSON(t *testing.T, scene whiteboardSvc.WhiteboardScene) string {
	t.Helper()
	payload, err := json.Marshal(scene)
	require.NoError(t, err)
	return string(payload)
}

func TestWhiteboardSceneStore_LoadsCanvasStateFromDB(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "loads DB canvas state when Redis is empty", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		require.NoError(t, rdb.FlushDB(ctx).Err())
		project, user := createSceneTestProject(t, db)
		canvasState := datatypes.JSON([]byte(`{"elements":[{"id":"db-element","type":"rectangle"}],"appState":{"viewBackgroundColor":"#ffffff"},"files":{}}`))
		_, err := svc.UpdateCanvasState(ctx, user.ID, project.ID, canvasState)
		require.NoError(t, err)

		store := whiteboardSvc.NewWhiteboardSceneStoreWithFlushDelay(rdb, svc, time.Hour)
		snapshot, err := store.LoadSnapshot(ctx, user.ID, project.ID)

		require.NoError(t, err)
		assert.Equal(t, int64(0), snapshot.Revision)
		assert.JSONEq(t, string(canvasState), sceneJSON(t, snapshot.Scene))
	})
}

func TestWhiteboardSceneStore_RedisSnapshotWinsOverDB(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "uses hot Redis snapshot before DB canvas state", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		require.NoError(t, rdb.FlushDB(ctx).Err())
		project, user := createSceneTestProject(t, db)
		dbCanvasState := datatypes.JSON([]byte(`{"elements":[{"id":"db-element","type":"rectangle"}],"appState":{},"files":{}}`))
		_, err := svc.UpdateCanvasState(ctx, user.ID, project.ID, dbCanvasState)
		require.NoError(t, err)

		store := whiteboardSvc.NewWhiteboardSceneStoreWithFlushDelay(rdb, svc, time.Hour)
		redisScene := whiteboardSvc.WhiteboardScene{
			Elements: []json.RawMessage{json.RawMessage(`{"id":"redis-element","type":"ellipse"}`)},
			AppState: json.RawMessage(`{}`),
			Files:    json.RawMessage(`{}`),
		}
		saved, err := store.SaveScene(ctx, project.ID, redisScene)
		require.NoError(t, err)

		loaded, err := store.LoadSnapshot(ctx, user.ID, project.ID)

		require.NoError(t, err)
		assert.Equal(t, saved.Revision, loaded.Revision)
		assert.JSONEq(t, sceneJSON(t, redisScene), sceneJSON(t, loaded.Scene))
	})
}

func TestWhiteboardSceneStore_LoadsLegacyElementsWhenCanvasEmpty(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "builds scene from legacy elements when canvas state is empty", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		require.NoError(t, rdb.FlushDB(ctx).Err())
		project, user := createSceneTestProject(t, db)
		_, err := svc.GetOrCreateWhiteboardByProjectID(ctx, user.ID, project.ID)
		require.NoError(t, err)

		_, err = svc.CreateElement(ctx, user.ID, project.ID, &models.WhiteboardElement{
			ElementType: "ellipse",
			Props:       datatypes.JSON([]byte(`{"id":"second","type":"ellipse"}`)),
			ZIndex:      2,
		})
		require.NoError(t, err)
		_, err = svc.CreateElement(ctx, user.ID, project.ID, &models.WhiteboardElement{
			ElementType: "rectangle",
			Props:       datatypes.JSON([]byte(`{"id":"first","type":"rectangle"}`)),
			ZIndex:      1,
		})
		require.NoError(t, err)

		store := whiteboardSvc.NewWhiteboardSceneStoreWithFlushDelay(rdb, svc, time.Hour)
		snapshot, err := store.LoadSnapshot(ctx, user.ID, project.ID)

		require.NoError(t, err)
		require.Len(t, snapshot.Scene.Elements, 2)
		assert.JSONEq(t, `{"id":"first","type":"rectangle"}`, string(snapshot.Scene.Elements[0]))
		assert.JSONEq(t, `{"id":"second","type":"ellipse"}`, string(snapshot.Scene.Elements[1]))
		assert.JSONEq(t, `{}`, string(snapshot.Scene.AppState))
		assert.JSONEq(t, `{}`, string(snapshot.Scene.Files))
	})
}

func TestWhiteboardSceneStore_FlushDirtyPersistsCanvasState(t *testing.T) {
	ctx := context.Background()

	runTest(t, db, "flushes dirty Redis scene to DB canvas state", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		require.NoError(t, rdb.FlushDB(ctx).Err())
		project, _ := createSceneTestProject(t, db)
		store := whiteboardSvc.NewWhiteboardSceneStoreWithFlushDelay(rdb, svc, time.Hour)
		scene := whiteboardSvc.WhiteboardScene{
			Elements: []json.RawMessage{json.RawMessage(`{"id":"flushed","type":"text"}`)},
			AppState: json.RawMessage(`{"theme":"light"}`),
			Files:    json.RawMessage(`{}`),
		}
		_, err := store.SaveScene(ctx, project.ID, scene)
		require.NoError(t, err)

		err = store.FlushDirty(ctx, project.ID)
		require.NoError(t, err)

		whiteboard, err := svc.GetWhiteboardByProjectID(ctx, project.ID)
		require.NoError(t, err)
		assert.JSONEq(t, sceneJSON(t, scene), string(whiteboard.CanvasState))
	})
}
