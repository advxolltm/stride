package whiteboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const maxFoldPendingRetries = 5

func (s *PendingElementStore) FoldPendingElementOperation(
	ctx context.Context,
	incoming PendingElementOperation,
) (*PendingElementOperation, bool, error) {
	stored, collapsed, err := s.FoldPendingElementOperations(ctx, []PendingElementOperation{incoming})
	if err != nil {
		return nil, false, err
	}
	if len(stored) == 0 || len(collapsed) == 0 {
		return nil, false, nil
	}
	return stored[0], collapsed[0], nil
}

func (s *PendingElementStore) FoldPendingElementOperations(
	ctx context.Context,
	incoming []PendingElementOperation,
) ([]*PendingElementOperation, []bool, error) {
	if len(incoming) == 0 {
		return nil, nil, nil
	}

	projectID := incoming[0].ProjectID
	for _, op := range incoming[1:] {
		if op.ProjectID != projectID {
			return nil, nil, fmt.Errorf("fold pending ops: operations span multiple projects")
		}
	}

	hashKey := pendingElementsKey(projectID)
	touchedFields := make(map[string]struct{}, len(incoming))
	for _, op := range incoming {
		touchedFields[op.ElementID.String()] = struct{}{}
	}

	var (
		stored    []*PendingElementOperation
		collapsed []bool
	)

	txFn := func(tx *redis.Tx) error {
		stored = make([]*PendingElementOperation, len(incoming))
		collapsed = make([]bool, len(incoming))

		pendingByField := make(map[string]*PendingElementOperation, len(touchedFields))
		for field := range touchedFields {
			raw, err := tx.HGet(ctx, hashKey, field).Result()
			switch {
			case errors.Is(err, redis.Nil):
				// no prior op
			case err != nil:
				return err
			default:
				var existing PendingElementOperation
				if err := json.Unmarshal([]byte(raw), &existing); err != nil {
					return fmt.Errorf("decode existing pending op: %w", err)
				}
				pendingByField[field] = &existing
			}
		}

		for index, op := range incoming {
			field := op.ElementID.String()
			merged, drop := foldOps(pendingByField[field], op)
			if drop {
				delete(pendingByField, field)
				collapsed[index] = true
				continue
			}

			mergedCopy := merged
			pendingByField[field] = &mergedCopy
			stored[index] = &mergedCopy
		}

		_, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			shouldIndexProject := false
			for field := range touchedFields {
				op, ok := pendingByField[field]
				if !ok {
					pipe.HDel(ctx, hashKey, field)
					continue
				}

				payload, err := json.Marshal(op)
				if err != nil {
					return err
				}
				pipe.HSet(ctx, hashKey, field, payload)
				shouldIndexProject = true
			}

			if shouldIndexProject {
				pipe.SAdd(ctx, pendingProjectsSetKey, projectID.String())
			}

			return nil
		})
		return err
	}

	for attempt := 0; attempt < maxFoldPendingRetries; attempt++ {
		err := s.rdb.Watch(ctx, txFn, hashKey)
		if err == nil {
			if hasCollapsedOperation(collapsed) {
				if cleanupErr := s.cleanupIfEmpty(ctx, projectID); cleanupErr != nil {
					return stored, collapsed, cleanupErr
				}
			}
			return stored, collapsed, nil
		}
		if errors.Is(err, redis.TxFailedErr) {
			waitWithJitter(ctx, attempt)
			continue
		}
		return nil, nil, err
	}
	return nil, nil, fmt.Errorf("fold pending op: watch retries exhausted")
}

func hasCollapsedOperation(collapsed []bool) bool {
	for _, item := range collapsed {
		if item {
			return true
		}
	}
	return false
}

func waitWithJitter(ctx context.Context, attempt int) {
	base := time.Duration(attempt+1) * 10 * time.Millisecond
	jitter := time.Duration(rand.Int63n(int64(base)))
	timer := time.NewTimer(base + jitter)
	defer timer.Stop()

	select {
	case <-ctx.Done():
	case <-timer.C:
	}
}

func (s *PendingElementStore) cleanupIfEmpty(ctx context.Context, projectID uuid.UUID) error {
	hashKey := pendingElementsKey(projectID)
	n, err := s.rdb.HLen(ctx, hashKey).Result()
	if err != nil {
		return err
	}

	if n > 0 {
		return nil
	}
	pipe := s.rdb.TxPipeline()
	pipe.Del(ctx,
		hashKey,
		pendingFlushAtKey(projectID),
		pendingFirstAtKey(projectID),
	)
	pipe.SRem(ctx, pendingProjectsSetKey, projectID.String())
	_, err = pipe.Exec(ctx)
	return err
}

func foldOps(existing *PendingElementOperation, incoming PendingElementOperation) (PendingElementOperation, bool) {
	if incoming.UpdatedAt.IsZero() {
		incoming.UpdatedAt = time.Now().UTC()
	}
	if existing == nil {
		return incoming, false
	}
	switch existing.Operation {
	case PendingElementCreate:
		switch incoming.Operation {
		case PendingElementDelete:
			return PendingElementOperation{}, true
		case PendingElementUpdate, PendingElementCreate:
			return overlayFields(*existing, incoming), false
		}

	case PendingElementUpdate:
		switch incoming.Operation {
		case PendingElementUpdate:
			return overlayFields(*existing, incoming), false
		case PendingElementDelete:
			incoming.WhiteboardID = existing.WhiteboardID
			if incoming.CreatedBy == nil {
				incoming.CreatedBy = existing.CreatedBy
			}
			return incoming, false
		case PendingElementCreate:
			return incoming, false
		}

	case PendingElementDelete:
		switch incoming.Operation {
		case PendingElementCreate:
			return incoming, false
		case PendingElementUpdate, PendingElementDelete:
			return *existing, false
		}
	}

	return incoming, false
}

func overlayFields(base, in PendingElementOperation) PendingElementOperation {
	if in.ElementType != "" {
		base.ElementType = in.ElementType
	}

	if len(in.Props) > 0 {
		base.Props = in.Props
	}

	if in.ZIndex != nil {
		base.ZIndex = in.ZIndex
	}

	if in.ClientID != "" {
		base.ClientID = in.ClientID
	}

	if in.OperationID != "" {
		base.OperationID = in.OperationID
	}

	if !in.UpdatedAt.IsZero() {
		base.UpdatedAt = in.UpdatedAt
	}
	return base
}
