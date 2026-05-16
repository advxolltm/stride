package whiteboard

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	whiteboardDB "backend/db/whiteboard"
	"backend/models"
	"backend/routes"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const DefaultFlusherInterval = 250 * time.Millisecond


type Flusher struct {
	pendingStore *whiteboardDB.PendingElementStore
	db           *gorm.DB
	rdb          *redis.Client
	interval     time.Duration
	now          func() time.Time
	logger       *slog.Logger
}


type FlusherOption func(*Flusher)

func WithFlusherInterval(d time.Duration) FlusherOption {
	return func(f *Flusher) {
		if d > 0 {
			f.interval = d
		}
	}
}

func WithFlusherClock(now func() time.Time) FlusherOption {
	return func(f *Flusher) {
		if now != nil {
			f.now = now
		}
	}
}

func WithFlusherLogger(l *slog.Logger) FlusherOption {
	return func(f *Flusher) {
		if l != nil {
			f.logger = l
		}
	}
}

func NewFlusher(
	pendingStore *whiteboardDB.PendingElementStore,
	db *gorm.DB,
	rdb *redis.Client,
	opts ...FlusherOption,
) *Flusher {
	f := &Flusher{
		pendingStore: pendingStore,
		db:           db,
		rdb:          rdb,
		interval:     DefaultFlusherInterval,
		now:          time.Now,
		logger:       slog.Default(),
	}
	for _, opt := range opts {
		opt(f)
	}
	return f
}


func (f *Flusher) Run(ctx context.Context) {
	if f == nil {
		return
	}
	t := time.NewTicker(f.interval)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			f.flushDue(ctx)
		}
	}
}

func (f *Flusher) FlushDue(ctx context.Context) { f.flushDue(ctx) }

func (f *Flusher) flushDue(ctx context.Context) {
	projects, err := f.pendingStore.ListPendingProjects(ctx)
	if err != nil {
		f.logger.Error("whiteboard flusher: list pending projects", "error", err)
		return
	}
	for _, projectID := range projects {
		if err := f.tryFlushProject(ctx, projectID); err != nil {
			f.logger.Error(
				"whiteboard flusher: flush project failed",
				"projectId", projectID,
				"error", err,
			)
		}
	}
}

func (f *Flusher) tryFlushProject(ctx context.Context, projectID uuid.UUID) error {
	flushAt, ok, err := f.pendingStore.ProjectFlushAt(ctx, projectID)
	if err != nil {
		return fmt.Errorf("read flush_at: %w", err)
	}
	if !ok {
		_ = f.pendingStore.RemoveProjectFromIndex(ctx, projectID)
		return nil
	}
	if f.now().Before(flushAt) {
		return nil
	}

	ops, err := f.pendingStore.ListPendingElementOperations(ctx, projectID)
	if err != nil {
		return fmt.Errorf("list pending ops: %w", err)
	}
	if len(ops) == 0 {
		return f.pendingStore.ClearFlushCycle(ctx, projectID)
	}

	if err := f.applyOpsTx(ctx, ops); err != nil {
		f.publishRollback(ctx, projectID, ops, err)
		return fmt.Errorf("%w: %w", ErrFlushPendingOperations, err)
	}

	ids := make([]uuid.UUID, len(ops))
	for i, op := range ops {
		ids[i] = op.ElementID
	}
	if err := f.pendingStore.DeletePendingElementOperations(ctx, projectID, ids...); err != nil {
		return fmt.Errorf("delete flushed ops: %w", err)
	}
	if err := f.pendingStore.ClearFlushCycle(ctx, projectID); err != nil {
		return fmt.Errorf("clear flush cycle: %w", err)
	}
	return nil
}

func (f *Flusher) applyOpsTx(ctx context.Context, ops []whiteboardDB.PendingElementOperation) error {
	return f.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		store := whiteboardDB.NewWhiteboardStore(tx)
		for _, op := range ops {
			if err := applyPendingOp(ctx, store, op); err != nil {
				return err
			}
		}
		return nil
	})
}

func applyPendingOp(
	ctx context.Context,
	store whiteboardDB.WhiteboardStore,
	op whiteboardDB.PendingElementOperation,
) error {
	switch op.Operation {
	case whiteboardDB.PendingElementCreate:
		z := 0
		if op.ZIndex != nil {
			z = *op.ZIndex
		}
		el := &models.WhiteboardElement{
			ID:           op.ElementID,
			WhiteboardID: op.WhiteboardID,
			CreatedBy:    op.CreatedBy,
			ElementType:  op.ElementType,
			Props:        op.Props,
			ZIndex:       z,
		}
		if _, err := store.CreateElement(ctx, el); err != nil {
			return fmt.Errorf("create element %s: %w", op.ElementID, err)
		}
		return nil

	case whiteboardDB.PendingElementUpdate:
		fields := whiteboardDB.UpdateElementFields{}
		if op.ElementType != "" {
			et := op.ElementType
			fields.ElementType = &et
		}
		if len(op.Props) > 0 {
			props := op.Props
			fields.Props = &props
		}
		if op.ZIndex != nil {
			z := *op.ZIndex
			fields.ZIndex = &z
		}
		if _, err := store.UpdateElement(ctx, op.ProjectID, op.ElementID, fields); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return fmt.Errorf("update element %s: %w", op.ElementID, err)
		}
		return nil

	case whiteboardDB.PendingElementDelete:
		if err := store.DeleteElement(ctx, op.ProjectID, op.ElementID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return fmt.Errorf("delete element %s: %w", op.ElementID, err)
		}
		return nil

	default:
		return fmt.Errorf("unknown pending operation %q", op.Operation)
	}
}

func (f *Flusher) publishRollback(
	ctx context.Context,
	projectID uuid.UUID,
	ops []whiteboardDB.PendingElementOperation,
	flushErr error,
) {
	reason := flushErr.Error()
	for _, op := range ops {
		meta := &routes.WSMessageMeta{
			OriginUserID: op.CreatedBy,
			ClientID:     op.ClientID,
			OperationID:  op.OperationID,
		}
		payload := routes.WhiteboardElementRollbackPayload{
			ProjectID:   projectID,
			ElementID:   op.ElementID,
			OperationID: op.OperationID,
			Reason:      reason,
		}
		if err := routes.SendWSUpdateWithMeta(
			ctx, f.rdb, projectID,
			routes.WhiteboardElementRollback, meta, payload,
		); err != nil {
			f.logger.Error(
				"whiteboard flusher: publish rollback",
				"projectId", projectID,
				"elementId", op.ElementID,
				"error", err,
			)
		}
	}
}
