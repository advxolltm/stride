package notification

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const defaultNotificationStreamPrefix = "notifications:user"

type Notification struct {
	ID 			uuid.UUID	`json:"id" gorm:"primaryKey;default:gen_random_uuid()"`
	UserID		uuid.UUID	`json:"user_id"`
	EditType	string		`json:"edit_type"`
	ObjectType	string		`json:"object_type"`
	ObjectID	uuid.UUID	`json:"object_id"`
	Message		string		`json:"message"`
	Read		bool		`json:"read"`
}

type (
	NotificationStreamEntry struct {
		RedisID			string			`json:"redis_id"`
		Notification	Notification 	`json:"notification"`
	}

	NotificationStreamStore interface {
		Append(ctx context.Context, notification Notification) (string, error)
		Range(ctx context.Context, userID uuid.UUID, start string, count int64) ([]NotificationStreamEntry, error)
		EnsureConsumerGroup(ctx context.Context, userID uuid.UUID, group string) error
	}

	notificationStreamStore struct {
		rdb				*redis.Client
		streamPrefix	string
	}
)

func NewNotificationStreamStore(rdb *redis.Client) NotificationStreamStore {
	return &notificationStreamStore{
		rdb:          rdb,
		streamPrefix: defaultNotificationStreamPrefix,
	}
}

func (s *notificationStreamStore) Append(ctx context.Context, notification Notification) (string, error) {
	if s.rdb == nil {
		return "", ErrRedisIsNil
	}

	if notification.ID == uuid.Nil {
		notification.ID = uuid.New()
	}

	redisID, err := s.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: s.streamKey(notification.UserID),
		Values: notificationToValues(notification),
	}).Result()
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrAppendNotificationToRedisStream, err)
	}

	return redisID, nil
}

func (s *notificationStreamStore) Range(ctx context.Context, userID uuid.UUID, start string, count int64) ([]NotificationStreamEntry, error) {

	if start == "" {
		start = "-"
	}

	if count <= 0 {
		count = 100
	}

	entries, err := s.rdb.XRangeN(ctx, s.streamKey(userID), start, "+", count).Result()
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrReadNotificationsFromRedisStream, err)
	}

	result := make([]NotificationStreamEntry, 0, len(entries))
	for _, entry := range entries {
		notification, err := notificationFromValues(entry.Values)
		if err != nil {
			return nil, fmt.Errorf("%w: %w", ErrParseNotificationFromStreamEntry, err)
		}

		result = append(result, NotificationStreamEntry{
			RedisID:      entry.ID,
			Notification: notification,
		})
	}

	return result, nil
}

func (s *notificationStreamStore) EnsureConsumerGroup(ctx context.Context, userID uuid.UUID, group string) error {

	err := s.rdb.XGroupCreateMkStream(ctx, s.streamKey(userID), group, "$").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return fmt.Errorf("%w: %w", ErrCreateRedisStreamConsumerGroup, err)
	}

	return nil
}

func (s *notificationStreamStore) streamKey(userID uuid.UUID) string {
	return fmt.Sprintf("%s:%s", s.streamPrefix, userID.String())
}

func notificationToValues(notification Notification) map[string]any {
	return map[string]any{
		"id":          notification.ID.String(),
		"user_id":     notification.UserID.String(),
		"object_type": notification.ObjectType,
		"object_id":   notification.ObjectID.String(),
		"message":     notification.Message,
		"read":        strconv.FormatBool(notification.Read),
	}
}

func notificationFromValues(values map[string]any) (Notification, error) {
	id, err := uuid.Parse(streamValueAsString(values["id"]))
	if err != nil {
		return Notification{}, err
	}

	userID, err := uuid.Parse(streamValueAsString(values["user_id"]))
	if err != nil {
		return Notification{}, err
	}

	objectID, err := uuid.Parse(streamValueAsString(values["object_id"]))
	if err != nil {
		return Notification{}, err
	}

	read, err := strconv.ParseBool(streamValueAsString(values["read"]))
	if err != nil {
		return Notification{}, err
	}

	return Notification{
		ID:         id,
		UserID:     userID,
		ObjectType: streamValueAsString(values["object_type"]),
		ObjectID:   objectID,
		Message:    streamValueAsString(values["message"]),
		Read:       read,
	}, nil
}

func streamValueAsString(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		return fmt.Sprint(v)
	}
}