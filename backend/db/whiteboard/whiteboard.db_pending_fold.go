package whiteboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

func (s *PendingElementStore) FoldPendingElementOperation(
	ctx context.Context,
	incoming PendingElementOperation,
) (*PendingElementOperation, bool, error) {
	hashKey := pendingElementsKey(incoming.ProjectID)
	field := incoming.ElementID.String()

	var (
		stored    *PendingElementOperation
		collapsed bool
	)

	txFn := func(tx *redis.Tx) error {
		raw, err := tx.HGet(ctx, hashKey, field).Result()
		var existing *PendingElementOperation
		switch {
			case errors.Is(err, redis.Nil):
				// no prior op

			case err != nil:
				return err

			default:
				var e PendingElementOperation
				if err := json.Unmarshal([]byte(raw), &e); err != nil {
					return fmt.Errorf("decode existing pending op: %w", err)
				}
				existing = &e
		}

		merged, drop := foldOps(existing, incoming)

		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			if drop {
				pipe.HDel(ctx, hashKey, field)
				return nil
			}

			payload, err := json.Marshal(merged)
			
			if err != nil {
				return err
			}
			pipe.HSet(ctx, hashKey, field, payload)
			pipe.SAdd(ctx, pendingProjectsSetKey, incoming.ProjectID.String())
			return nil
		})
		if err != nil {
			return err
		}

		if drop {
			stored = nil
			collapsed = true
		} else {
			m := merged
			stored = &m
			collapsed = false
		}
		return nil
	}

	const maxRetries = 5
	for i := 0; i < maxRetries; i++ {
		err := s.rdb.Watch(ctx, txFn, hashKey)
		if err == nil {
			if collapsed {
				if cleanupErr := s.cleanupIfEmpty(ctx, incoming.ProjectID); cleanupErr != nil {
					return stored, collapsed, cleanupErr
				}
			}
			return stored, collapsed, nil
		}
		if errors.Is(err, redis.TxFailedErr) {
			continue
		}
		return nil, false, err
	}
	return nil, false, fmt.Errorf("fold pending op: watch retries exhausted")
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
