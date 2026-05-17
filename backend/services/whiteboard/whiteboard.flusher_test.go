package whiteboard_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	whiteboardDB "backend/db/whiteboard"
	"backend/models"
	"backend/routes"
	whiteboardSvc "backend/services/whiteboard"
	"backend/testutils"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)


type fakeClock struct{ t time.Time }

func newFakeClock(t time.Time) *fakeClock { return &fakeClock{t: t} }
func (c *fakeClock) Now() time.Time       { return c.t }
func (c *fakeClock) Advance(d time.Duration) {
	c.t = c.t.Add(d)
}

func newTestFlusher(db *gorm.DB, clock *fakeClock) (*whiteboardSvc.Flusher, *whiteboardDB.PendingElementStore) {
	pendingStore := whiteboardDB.NewPendingElementStore(rdb)
	f := whiteboardSvc.NewFlusher(
		pendingStore, db, rdb,
		whiteboardSvc.WithFlusherClock(clock.Now),
	)
	return f, pendingStore
}

func setupProjectWithWhiteboard(t *testing.T, db *gorm.DB) (models.Project, models.User, models.Whiteboard) {
	t.Helper()
	project, member := selectProjectMember(t, db)
	svc := newTestService(db)
	wb, err := svc.GetOrCreateWhiteboardByProjectID(context.Background(), member.ID, project.ID)
	require.NoError(t, err)
	return project, member, *wb
}

func zPtr(v int) *int { return &v }

func pendingKeysForFlush(projectID uuid.UUID) []string {
	return pendingKeysFor(projectID)
}


func subscribeProjectChannel(t *testing.T, projectID uuid.UUID) (<-chan *redis.Message, func()) {
	t.Helper()
	sub := rdb.Subscribe(context.Background(), projectID.String())
	_, err := sub.Receive(context.Background())
	require.NoError(t, err)
	return sub.Channel(), func() { _ = sub.Close() }
}


func drainMessagesUntil(ch <-chan *redis.Message, quietFor time.Duration, deadline time.Duration) []*redis.Message {
	var out []*redis.Message
	timeout := time.After(deadline)
	for {
		select {
		case m := <-ch:
			out = append(out, m)
		case <-time.After(quietFor):
			return out
		case <-timeout:
			return out
		}
	}
}

func TestFlusher_SkipsWhenFlushAtInFuture(t *testing.T) {
	runTest(t, db, "skip future flush_at", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member, wb := setupProjectWithWhiteboard(t, db)
		ctx := context.Background()

		clock := newFakeClock(time.Now().UTC())
		f, pendingStore := newTestFlusher(db, clock)

		testutils.RunRedisTestTransaction(t, rdb, pendingKeysForFlush(project.ID), func() {
			op := whiteboardDB.PendingElementOperation{
				ProjectID:    project.ID,
				ElementID:    uuid.New(),
				WhiteboardID: wb.ID,
				Operation:    whiteboardDB.PendingElementCreate,
				CreatedBy:    &member.ID,
				ElementType:  "rect",
				Props:        datatypes.JSON([]byte(`{"id":"a"}`)),
				ZIndex:       zPtr(0),
				UpdatedAt:    clock.Now(),
			}
			require.NoError(t, pendingStore.PutPendingElementOperation(ctx, op))
			require.NoError(t, pendingStore.MarkProjectPendingFlush(ctx, project.ID, clock.Now()))

			f.FlushDue(ctx)

			ops, err := pendingStore.ListPendingElementOperations(ctx, project.ID)
			require.NoError(t, err)
			assert.Len(t, ops, 1, "ops must remain when flush_at is in the future")

			_, err = svc.GetElement(ctx, member.ID, project.ID, op.ElementID)
			assert.ErrorIs(t, err, gorm.ErrRecordNotFound, "DB unchanged before flush")
		})
	})
}

func TestFlusher_FlushesCreateUpdateDelete_WhenDue(t *testing.T) {
	runTest(t, db, "flush all op types when due", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member, wb := setupProjectWithWhiteboard(t, db)
		ctx := context.Background()

		seededUpdate, err := svc.CreateElement(ctx, member.ID, project.ID, &models.WhiteboardElement{
			ElementType: "rect",
			Props:       datatypes.JSON([]byte(`{"id":"upd"}`)),
		})
		require.NoError(t, err)
		seededDelete, err := svc.CreateElement(ctx, member.ID, project.ID, &models.WhiteboardElement{
			ElementType: "rect",
			Props:       datatypes.JSON([]byte(`{"id":"del"}`)),
		})
		require.NoError(t, err)

		clock := newFakeClock(time.Now().UTC())
		f, pendingStore := newTestFlusher(db, clock)
		createID := uuid.New()

		testutils.RunRedisTestTransaction(t, rdb, pendingKeysForFlush(project.ID), func() {
			ops := []whiteboardDB.PendingElementOperation{
				{
					ProjectID:    project.ID,
					ElementID:    createID,
					WhiteboardID: wb.ID,
					Operation:    whiteboardDB.PendingElementCreate,
					CreatedBy:    &member.ID,
					ElementType:  "ellipse",
					Props:        datatypes.JSON([]byte(`{"id":"new"}`)),
					ZIndex:       zPtr(7),
					UpdatedAt:    clock.Now(),
				},
				{
					ProjectID:    project.ID,
					ElementID:    seededUpdate.ID,
					WhiteboardID: wb.ID,
					Operation:    whiteboardDB.PendingElementUpdate,
					Props:        datatypes.JSON([]byte(`{"id":"upd","x":99}`)),
					ZIndex:       zPtr(3),
					UpdatedAt:    clock.Now(),
				},
				{
					ProjectID:    project.ID,
					ElementID:    seededDelete.ID,
					WhiteboardID: wb.ID,
					Operation:    whiteboardDB.PendingElementDelete,
					UpdatedAt:    clock.Now(),
				},
			}
			for _, op := range ops {
				require.NoError(t, pendingStore.PutPendingElementOperation(ctx, op))
			}
			require.NoError(t, pendingStore.MarkProjectPendingFlush(ctx, project.ID, clock.Now()))

			clock.Advance(whiteboardDB.PendingFlushQuietWindow + time.Second)

			f.FlushDue(ctx)

			remaining, err := pendingStore.ListPendingElementOperations(ctx, project.ID)
			require.NoError(t, err)
			assert.Empty(t, remaining)

			_, ok, err := pendingStore.ProjectFlushAt(ctx, project.ID)
			require.NoError(t, err)
			assert.False(t, ok, "flush_at must be cleared after success")

			created, err := svc.GetElement(ctx, member.ID, project.ID, createID)
			require.NoError(t, err)
			assert.Equal(t, "ellipse", created.ElementType)
			assert.Equal(t, 7, created.ZIndex)

			updated, err := svc.GetElement(ctx, member.ID, project.ID, seededUpdate.ID)
			require.NoError(t, err)
			assert.JSONEq(t, `{"id":"upd","x":99}`, string(updated.Props))
			assert.Equal(t, 3, updated.ZIndex)

			_, err = svc.GetElement(ctx, member.ID, project.ID, seededDelete.ID)
			assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
		})
	})
}

func TestFlusher_RestartRecovery(t *testing.T) {
	runTest(t, db, "new flusher recovers pending ops from Redis", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member, wb := setupProjectWithWhiteboard(t, db)
		ctx := context.Background()

		clock := newFakeClock(time.Now().UTC())
		_, pendingStore := newTestFlusher(db, clock)
		elementID := uuid.New()

		testutils.RunRedisTestTransaction(t, rdb, pendingKeysForFlush(project.ID), func() {
			require.NoError(t, pendingStore.PutPendingElementOperation(ctx, whiteboardDB.PendingElementOperation{
				ProjectID:    project.ID,
				ElementID:    elementID,
				WhiteboardID: wb.ID,
				Operation:    whiteboardDB.PendingElementCreate,
				CreatedBy:    &member.ID,
				ElementType:  "rect",
				Props:        datatypes.JSON([]byte(`{"id":"restart"}`)),
				ZIndex:       zPtr(0),
				UpdatedAt:    clock.Now(),
			}))
			require.NoError(t, pendingStore.MarkProjectPendingFlush(ctx, project.ID, clock.Now()))

			clock.Advance(whiteboardDB.PendingFlushQuietWindow + time.Second)
			restarted, _ := newTestFlusher(db, clock)
			restarted.FlushDue(ctx)

			el, err := svc.GetElement(ctx, member.ID, project.ID, elementID)
			require.NoError(t, err)
			assert.Equal(t, elementID, el.ID)
		})
	})
}

func TestFlusher_NoPubSubEventOnSuccess(t *testing.T) {
	runTest(t, db, "success path publishes no events", func(t *testing.T, db *gorm.DB, _ whiteboardSvc.WhiteboardService) {
		project, member, wb := setupProjectWithWhiteboard(t, db)
		ctx := context.Background()

		ch, closeSub := subscribeProjectChannel(t, project.ID)
		t.Cleanup(closeSub)

		clock := newFakeClock(time.Now().UTC())
		f, pendingStore := newTestFlusher(db, clock)

		testutils.RunRedisTestTransaction(t, rdb, pendingKeysForFlush(project.ID), func() {
			require.NoError(t, pendingStore.PutPendingElementOperation(ctx, whiteboardDB.PendingElementOperation{
				ProjectID:    project.ID,
				ElementID:    uuid.New(),
				WhiteboardID: wb.ID,
				Operation:    whiteboardDB.PendingElementCreate,
				CreatedBy:    &member.ID,
				ElementType:  "rect",
				Props:        datatypes.JSON([]byte(`{"id":"silent"}`)),
				ZIndex:       zPtr(0),
				UpdatedAt:    clock.Now(),
			}))
			require.NoError(t, pendingStore.MarkProjectPendingFlush(ctx, project.ID, clock.Now()))

			clock.Advance(whiteboardDB.PendingFlushQuietWindow + time.Second)
			f.FlushDue(ctx)

			msgs := drainMessagesUntil(ch, 250*time.Millisecond, 2*time.Second)
			for _, m := range msgs {
				var env struct {
					Type routes.WSMessageType `json:"type"`
				}
				require.NoError(t, json.Unmarshal([]byte(m.Payload), &env))
				assert.NotEqual(t, routes.WhiteboardElementCreate, env.Type, "no create event must be re-published on flush success")
				assert.NotEqual(t, routes.WhiteboardElementRollback, env.Type, "no rollback on success")
			}
		})
	})
}

func TestFlusher_PublishesRollbackOnFailure(t *testing.T) {
	runTest(t, db, "failure path publishes rollback events with metadata", func(t *testing.T, db *gorm.DB, _ whiteboardSvc.WhiteboardService) {
		project, member, _ := setupProjectWithWhiteboard(t, db)
		ctx := context.Background()

		ch, closeSub := subscribeProjectChannel(t, project.ID)
		t.Cleanup(closeSub)

		clock := newFakeClock(time.Now().UTC())
		f, pendingStore := newTestFlusher(db, clock)
		elementID := uuid.New()
		opID := "op-" + uuid.NewString()
		clientID := "client-abc"

		testutils.RunRedisTestTransaction(t, rdb, pendingKeysForFlush(project.ID), func() {

			require.NoError(t, pendingStore.PutPendingElementOperation(ctx, whiteboardDB.PendingElementOperation{
				ProjectID:    project.ID,
				ElementID:    elementID,
				WhiteboardID: uuid.New(), // unknown FK -> insert fails
				Operation:    whiteboardDB.PendingElementCreate,
				CreatedBy:    &member.ID,
				ElementType:  "rect",
				Props:        datatypes.JSON([]byte(`{"id":"boom"}`)),
				ZIndex:       zPtr(0),
				ClientID:     clientID,
				OperationID:  opID,
				UpdatedAt:    clock.Now(),
			}))
			require.NoError(t, pendingStore.MarkProjectPendingFlush(ctx, project.ID, clock.Now()))

			clock.Advance(whiteboardDB.PendingFlushQuietWindow + time.Second)
			f.FlushDue(ctx)

			remaining, err := pendingStore.ListPendingElementOperations(ctx, project.ID)
			require.NoError(t, err)
			assert.Len(t, remaining, 1, "failed ops stay buffered")

			// Rollback event must be observable on the project channel.
			msgs := drainMessagesUntil(ch, 250*time.Millisecond, 2*time.Second)
			rollback := findRollbackForElement(t, msgs, elementID)
			require.NotNil(t, rollback, "expected rollback message for element %s", elementID)

			assert.Equal(t, opID, rollback.Meta.OperationID, "rollback meta carries originating OperationID")
			assert.Equal(t, clientID, rollback.Meta.ClientID, "rollback meta carries originating ClientID")
			require.NotNil(t, rollback.Meta.OriginUserID)
			assert.Equal(t, member.ID, *rollback.Meta.OriginUserID, "rollback meta carries originating user")
			assert.Equal(t, project.ID, rollback.Payload.ProjectID)
			assert.Equal(t, elementID, rollback.Payload.ElementID)
			assert.Equal(t, opID, rollback.Payload.OperationID)
			assert.NotEmpty(t, rollback.Payload.Reason)
		})
	})
}

func TestFlusher_RollbackUsesLatestFoldedClientMetadata(t *testing.T) {
	runTest(t, db, "rollback carries latest client metadata after create-update fold", func(t *testing.T, db *gorm.DB, svc whiteboardSvc.WhiteboardService) {
		project, member, _ := setupProjectWithWhiteboard(t, db)
		ctx := context.Background()

		ch, closeSub := subscribeProjectChannel(t, project.ID)
		t.Cleanup(closeSub)

		clock := newFakeClock(time.Now().UTC())
		f, pendingStore := newTestFlusher(db, clock)

		testutils.RunRedisTestTransaction(t, rdb, pendingKeysForFlush(project.ID), func() {
			created, err := svc.BufferCreateElement(ctx, project.ID,
				whiteboardSvc.ElementBufferMeta{UserID: member.ID, ClientID: "client-a", OperationID: "op-1"},
				whiteboardSvc.CreateElementInput{
					ElementType: "rect",
					Props:       datatypes.JSON([]byte(`{"id":"fold-meta"}`)),
					ZIndex:      1,
				},
			)
			require.NoError(t, err)
			require.NotNil(t, created)
			require.NotNil(t, created.Op)

			updatedProps := datatypes.JSON([]byte(`{"id":"fold-meta","x":42}`))
			updated, err := svc.BufferUpdateElement(ctx, project.ID, created.Op.ElementID,
				whiteboardSvc.ElementBufferMeta{UserID: member.ID, ClientID: "client-b", OperationID: "op-2"},
				whiteboardDB.UpdateElementFields{Props: &updatedProps},
			)
			require.NoError(t, err)
			require.NotNil(t, updated)
			require.NotNil(t, updated.Op)
			assert.Equal(t, whiteboardDB.PendingElementCreate, updated.Op.Operation)
			assert.Equal(t, "client-b", updated.Op.ClientID)
			assert.Equal(t, "op-2", updated.Op.OperationID)

			ops, err := pendingStore.ListPendingElementOperations(ctx, project.ID)
			require.NoError(t, err)
			require.Len(t, ops, 1)
			op := ops[0]
			assert.Equal(t, "client-b", op.ClientID)
			assert.Equal(t, "op-2", op.OperationID)

			// Force flush failure while preserving latest folded metadata.
			op.WhiteboardID = uuid.New()
			require.NoError(t, pendingStore.PutPendingElementOperation(ctx, op))

			clock.Advance(whiteboardDB.PendingFlushQuietWindow + time.Second)
			f.FlushDue(ctx)

			remaining, err := pendingStore.ListPendingElementOperations(ctx, project.ID)
			require.NoError(t, err)
			require.Len(t, remaining, 1)

			msgs := drainMessagesUntil(ch, 250*time.Millisecond, 2*time.Second)
			rollback := findRollbackForElement(t, msgs, op.ElementID)
			require.NotNil(t, rollback)
			assert.Equal(t, "client-b", rollback.Meta.ClientID)
			assert.Equal(t, "op-2", rollback.Meta.OperationID)
			require.NotNil(t, rollback.Meta.OriginUserID)
			assert.Equal(t, member.ID, *rollback.Meta.OriginUserID)
			assert.Equal(t, "op-2", rollback.Payload.OperationID)
		})
	})
}

type capturedRollback struct {
	Meta    routes.WSMessageMeta
	Payload routes.WhiteboardElementRollbackPayload
}

func findRollbackForElement(t *testing.T, msgs []*redis.Message, elementID uuid.UUID) *capturedRollback {
	t.Helper()
	for _, m := range msgs {
		var env struct {
			Type    routes.WSMessageType                 `json:"type"`
			Meta    routes.WSMessageMeta                 `json:"meta"`
			Payload routes.WhiteboardElementRollbackPayload `json:"payload"`
		}
		if err := json.Unmarshal([]byte(m.Payload), &env); err != nil {
			continue
		}
		if env.Type != routes.WhiteboardElementRollback {
			continue
		}
		if env.Payload.ElementID != elementID {
			continue
		}
		return &capturedRollback{Meta: env.Meta, Payload: env.Payload}
	}
	return nil
}

func TestFlusher_NoOpWhenIdle(t *testing.T) {
}
