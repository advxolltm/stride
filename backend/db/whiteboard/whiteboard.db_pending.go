package whiteboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/datatypes"
)


type PendingElementOperationType string

const (
    PendingElementCreate PendingElementOperationType = "create"
    PendingElementUpdate PendingElementOperationType = "update"
    PendingElementDelete PendingElementOperationType = "delete"
)


type PendingElementOperation struct {
    ProjectID    uuid.UUID                  `json:"projectId"`
    ElementID    uuid.UUID                  `json:"elementId"`
    WhiteboardID uuid.UUID                  `json:"whiteboardId"`
    Operation    PendingElementOperationType `json:"operation"`
    CreatedBy    *uuid.UUID                 `json:"createdBy,omitempty"`
    ElementType  string                     `json:"elementType"`
    Props        datatypes.JSON             `json:"props"`
    ZIndex       *int                       `json:"zIndex"`
    ClientID     string                     `json:"clientId,omitempty"`
    OperationID  string                     `json:"operationId,omitempty"`
    UpdatedAt    time.Time                  `json:"updatedAt"`
}

const (
    PendingFlushQuietWindow = 2 * time.Second
    PendingFlushMaxWait     = 10 * time.Second
)

const pendingProjectsSetKey = "whiteboard:pending:projects"


func pendingElementsKey(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:pending:%s:elements", projectID)
}

func pendingFlushAtKey(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:pending:%s:flush_at", projectID)
}


type PendingElementStore struct {
	rdb *redis.Client
}

func NewPendingElementStore(rdb *redis.Client) *PendingElementStore {
    return &PendingElementStore{rdb: rdb}
}


func (s *PendingElementStore) PutPendingElementOperation(
	ctx context.Context,
    op PendingElementOperation,
) error {
	if (op.UpdatedAt.IsZero()) {
		op.UpdatedAt = time.Now().UTC()
	}
	payload, err := json.Marshal(op)
	if err != nil {
		return fmt.Errorf("marshal pending op: %w", err)
	}

	pipe := s.rdb.TxPipeline()
	pipe.HSet(ctx, pendingElementsKey(op.ProjectID), op.ElementID.String(), payload)
	pipe.SAdd(ctx, pendingProjectsSetKey, op.ProjectID.String())
	_, err = pipe.Exec(ctx)
	return err
}


func (s *PendingElementStore) ListPendingElementOperations(
    ctx context.Context,
    projectID uuid.UUID,
) ([]PendingElementOperation, error) {
    raw, err := s.rdb.HGetAll(ctx, pendingElementsKey(projectID)).Result()
    if err != nil {
        return nil, err
    }
    if len(raw) == 0 {
        return nil, nil
    }

    ops := make([]PendingElementOperation, 0, len(raw))
    for field, payload := range raw {
        var op PendingElementOperation
        if err := json.Unmarshal([]byte(payload), &op); err != nil {
            return nil, fmt.Errorf("decode pending op %s: %w", field, err)
        }
        ops = append(ops, op)
    }
    return ops, nil
}

func (s *PendingElementStore) GetPendingElementOperation(
    ctx context.Context,
    projectID, elementID uuid.UUID,
) (*PendingElementOperation, error) {
    payload, err := s.rdb.HGet(ctx, pendingElementsKey(projectID), elementID.String()).Result()
    if errors.Is(err, redis.Nil) {
        return nil, ErrPendingOperationNotFound
    }
    if err != nil {
        return nil, err
    }
    var op PendingElementOperation
    if err := json.Unmarshal([]byte(payload), &op); err != nil {
        return nil, fmt.Errorf("decode pending op: %w", err)
    }
    return &op, nil
}


func (s *PendingElementStore) DeletePendingElementOperations(
    ctx context.Context,
    projectID uuid.UUID,
    elementIDs ...uuid.UUID,
) error {
    if len(elementIDs) == 0 {
        return nil
    }
    fields := make([]string, len(elementIDs))
    for i, id := range elementIDs {
        fields[i] = id.String()
    }

    hashKey := pendingElementsKey(projectID)
    if err := s.rdb.HDel(ctx, hashKey, fields...).Err(); err != nil {
        return err
    }

    remaining, err := s.rdb.HLen(ctx, hashKey).Result()
    if err != nil {
        return err
    }
    if remaining > 0 {
        return nil
    }

    pipe := s.rdb.TxPipeline()
    pipe.Del(ctx, hashKey, pendingFlushAtKey(projectID))
    pipe.SRem(ctx, pendingProjectsSetKey, projectID.String())
    _, err = pipe.Exec(ctx)
    return err
}



func pendingFirstAtKey(projectID uuid.UUID) string {
    return fmt.Sprintf("whiteboard:pending:%s:first_pending_at", projectID)
}

func (s *PendingElementStore) MarkProjectPendingFlush(
    ctx context.Context,
    projectID uuid.UUID,
    now time.Time,
) error {
    firstAtKey := pendingFirstAtKey(projectID)
    flushAtKey := pendingFlushAtKey(projectID)
    nowMs := now.UnixMilli()

    // Anchor the ceiling on the first pending op of the cycle.
    if err := s.rdb.SetNX(ctx, firstAtKey, nowMs, 0).Err(); err != nil {
        return err
    }
    firstAtStr, err := s.rdb.Get(ctx, firstAtKey).Result()
    if err != nil {
        return err
    }
    var firstAt int64
    if _, err := fmt.Sscanf(firstAtStr, "%d", &firstAt); err != nil {
        return fmt.Errorf("decode first_pending_at: %w", err)
    }

    quiet := nowMs + PendingFlushQuietWindow.Milliseconds()
    ceiling := firstAt + PendingFlushMaxWait.Milliseconds()
    flushAt := quiet
    if ceiling < flushAt {
        flushAt = ceiling
    }

    pipe := s.rdb.TxPipeline()
    pipe.Set(ctx, flushAtKey, flushAt, 0)
    pipe.SAdd(ctx, pendingProjectsSetKey, projectID.String())
    _, err = pipe.Exec(ctx)
    return err
}

func (s *PendingElementStore) ProjectFlushAt(
    ctx context.Context,
    projectID uuid.UUID,
) (time.Time, bool, error) {
    v, err := s.rdb.Get(ctx, pendingFlushAtKey(projectID)).Result()
    if errors.Is(err, redis.Nil) {
        return time.Time{}, false, nil
    }
    if err != nil {
        return time.Time{}, false, err
    }
    var ms int64
    if _, err := fmt.Sscanf(v, "%d", &ms); err != nil {
        return time.Time{}, false, err
    }
    return time.UnixMilli(ms), true, nil
}

func (s *PendingElementStore) ClearFlushCycle(
    ctx context.Context,
    projectID uuid.UUID,
) error {
    return s.rdb.Del(ctx,
        pendingFlushAtKey(projectID),
        pendingFirstAtKey(projectID),
    ).Err()
}

func (s *PendingElementStore) ListPendingProjects(
    ctx context.Context,
) ([]uuid.UUID, error) {
    members, err := s.rdb.SMembers(ctx, pendingProjectsSetKey).Result()
    if err != nil {
        return nil, err
    }
    out := make([]uuid.UUID, 0, len(members))
    for _, m := range members {
        id, err := uuid.Parse(m)
        if err != nil {
            _ = s.rdb.SRem(ctx, pendingProjectsSetKey, m).Err()
            continue
        }
        out = append(out, id)
    }
    return out, nil
}