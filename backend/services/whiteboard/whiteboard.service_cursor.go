package whiteboard

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type CursorUser struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AvatarSmall string `json:"avatarSmall"`
}

type CursorPosition struct {
	X *float64 `json:"x"`
	Y *float64 `json:"y"`
}

type CursorPresence struct {
	User   CursorUser     `json:"user"`
	Cursor CursorPosition `json:"cursor"`
}

type CursorPresenceRecord struct {
	ConnectionID string                   `json:"connectionId"`
	User         CursorUser               `json:"user"`
	Cursor       CursorPosition           `json:"cursor"`
	UpdatedAt    time.Time                `json:"updatedAt"`
}

type CursorClientMessage struct {
	Cursor CursorPosition `json:"cursor"`
}

type CursorPresenceStore struct {
	rdb *redis.Client
}

func NewCursorPresenceStore(rdb *redis.Client) *CursorPresenceStore {
	return &CursorPresenceStore{rdb: rdb}
}

func cursorPresenceKey(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:cursor:presence:%s", projectID)
}

func CursorPresenceChannel(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:cursor:updates:%s", projectID)
}

func (s *CursorPresenceStore) PutConnection(
	ctx context.Context,
	projectID uuid.UUID,
	record CursorPresenceRecord,
) error {
	payload, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrMarshalCursorPresence, err)
	}

	if err := s.rdb.HSet(ctx, cursorPresenceKey(projectID), record.ConnectionID, payload).Err(); err != nil {
		return fmt.Errorf("%w: %w", ErrStoreCursorPresence, err)
	}

	return nil
}

func (s *CursorPresenceStore) RemoveConnection(
	ctx context.Context,
	projectID uuid.UUID,
	connectionID string,
) error {
	if err := s.rdb.HDel(ctx, cursorPresenceKey(projectID), connectionID).Err(); err != nil {
		return fmt.Errorf("%w: %w", ErrDeleteCursorPresence, err)
	}

	return nil
}

func (s *CursorPresenceStore) Snapshot(
	ctx context.Context,
	projectID uuid.UUID,
) ([]CursorPresence, error) {
	rawRecords, err := s.rdb.HVals(ctx, cursorPresenceKey(projectID)).Result()
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrLoadCursorPresence, err)
	}

	latestByUser := make(map[string]CursorPresenceRecord, len(rawRecords))
	for _, rawRecord := range rawRecords {
		var record CursorPresenceRecord
		if err := json.Unmarshal([]byte(rawRecord), &record); err != nil {
			return nil, fmt.Errorf("%w: %w", ErrDecodeCursorPresence, err)
		}

		existing, ok := latestByUser[record.User.ID]
		if !ok || record.UpdatedAt.After(existing.UpdatedAt) {
			latestByUser[record.User.ID] = record
		}
	}

	snapshot := make([]CursorPresence, 0, len(latestByUser))
	for _, record := range latestByUser {
		snapshot = append(snapshot, CursorPresence{
			User:   record.User,
			Cursor: record.Cursor,
		})
	}

	sort.Slice(snapshot, func(i, j int) bool {
		if snapshot[i].User.Name == snapshot[j].User.Name {
			return snapshot[i].User.ID < snapshot[j].User.ID
		}
		return snapshot[i].User.Name < snapshot[j].User.Name
	})

	return snapshot, nil
}

func (s *CursorPresenceStore) PublishSnapshot(
	ctx context.Context,
	projectID uuid.UUID,
) error {
	snapshot, err := s.Snapshot(ctx, projectID)
	if err != nil {
		return err
	}

	payload, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrMarshalCursorSnapshot, err)
	}

	if err := s.rdb.Publish(ctx, CursorPresenceChannel(projectID), payload).Err(); err != nil {
		return fmt.Errorf("%w: %w", ErrPublishCursorSnapshot, err)
	}

	return nil
}