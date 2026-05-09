package notification

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	defaultNotificationStreamPrefix       = "notifications:user"
	NotificationStreamMaxLen        int64 = 100
	NotificationStreamTTL                 = 30 * 24 * time.Hour
)

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
		AppendMany(ctx context.Context, notifications []Notification) ([]string, error)
		Range(ctx context.Context, userID uuid.UUID, start string, count int64) ([]NotificationStreamEntry, error)
		Delete(ctx context.Context, userID uuid.UUID, redisIDs ...string) error
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

func NotificationStreamKey(userID uuid.UUID) string {
	return fmt.Sprintf("%s:%s", defaultNotificationStreamPrefix, userID.String())
}

func (s *notificationStreamStore) Append(ctx context.Context, notification Notification) (string, error) {
	if s.rdb == nil {
		return "", ErrRedisIsNil
	}

	notification = prepareNotification(notification)
	streamKey := s.streamKey(notification.UserID)

	pipe := s.rdb.Pipeline()
	xAddCmd := pipe.XAdd(ctx, &redis.XAddArgs{
		Stream: streamKey,
		MaxLen: NotificationStreamMaxLen,
		Values: notificationToValues(notification),
	})
	expireCmd := pipe.Expire(ctx, streamKey, NotificationStreamTTL)

	if _, err := pipe.Exec(ctx); err != nil {
		if xAddCmd.Err() != nil {
			return "", fmt.Errorf("%w: %w", ErrAppendNotificationToRedisStream, xAddCmd.Err())
		}
		if expireCmd.Err() != nil {
			return "", fmt.Errorf("%w: %w", ErrSetNotificationStreamTTL, expireCmd.Err())
		}
		return "", fmt.Errorf("%w: %w", ErrAppendNotificationToRedisStream, err)
	}

	redisID, err := xAddCmd.Result()
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrAppendNotificationToRedisStream, err)
	}
	if err := expireCmd.Err(); err != nil {
		return "", fmt.Errorf("%w: %w", ErrSetNotificationStreamTTL, err)
	}

	return redisID, nil
}

func (s *notificationStreamStore) AppendMany(ctx context.Context, notifications []Notification) ([]string, error) {
	if s.rdb == nil {
		return nil, ErrRedisIsNil
	}

	if len(notifications) == 0 {
		return []string{}, nil
	}

	pipe := s.rdb.Pipeline()
	cmds := make([]*redis.StringCmd, 0, len(notifications))
	expireCmds := make([]*redis.BoolCmd, 0, len(notifications))
	for _, notification := range notifications {
		notification = prepareNotification(notification)
		streamKey := s.streamKey(notification.UserID)
		cmds = append(cmds, pipe.XAdd(ctx, &redis.XAddArgs{
			Stream: streamKey,
			MaxLen: NotificationStreamMaxLen,
			Values: notificationToValues(notification),
		}))
		expireCmds = append(expireCmds, pipe.Expire(ctx, streamKey, NotificationStreamTTL))
	}

	if _, err := pipe.Exec(ctx); err != nil {
		for _, cmd := range cmds {
			if cmd.Err() != nil {
				return nil, fmt.Errorf("%w: %w", ErrAppendNotificationToRedisStream, cmd.Err())
			}
		}
		for _, cmd := range expireCmds {
			if cmd.Err() != nil {
				return nil, fmt.Errorf("%w: %w", ErrSetNotificationStreamTTL, cmd.Err())
			}
		}
		return nil, fmt.Errorf("%w: %w", ErrAppendNotificationToRedisStream, err)
	}

	redisIDs := make([]string, 0, len(cmds))
	for _, cmd := range cmds {
		redisID, err := cmd.Result()
		if err != nil {
			return nil, fmt.Errorf("%w: %w", ErrAppendNotificationToRedisStream, err)
		}

		redisIDs = append(redisIDs, redisID)
	}
	for _, cmd := range expireCmds {
		if err := cmd.Err(); err != nil {
			return nil, fmt.Errorf("%w: %w", ErrSetNotificationStreamTTL, err)
		}
	}

	return redisIDs, nil
}

func (s *notificationStreamStore) Range(ctx context.Context, userID uuid.UUID, start string, count int64) ([]NotificationStreamEntry, error) {
	if s.rdb == nil {
		return nil, ErrRedisIsNil
	}

	if start == "" {
		start = "-"
	}

	if count <= 0 {
		count = NotificationStreamMaxLen
	}

	entries, err := s.rdb.XRangeN(ctx, s.streamKey(userID), start, "+", count).Result()
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrReadNotificationsFromRedisStream, err)
	}

	result := make([]NotificationStreamEntry, 0, len(entries))
	for _, entry := range entries {
		notification, err := NotificationFromStreamValues(entry.Values)
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

func (s *notificationStreamStore) streamKey(userID uuid.UUID) string {
	if s.streamPrefix == defaultNotificationStreamPrefix {
		return NotificationStreamKey(userID)
	}

	return fmt.Sprintf("%s:%s", s.streamPrefix, userID.String())
}

func notificationToValues(notification Notification) map[string]any {
	return map[string]any{
		"id":          notification.ID.String(),
		"user_id":     notification.UserID.String(),
		"edit_type":   notification.EditType,
		"object_type": notification.ObjectType,
		"object_id":   notification.ObjectID.String(),
		"message":     notification.Message,
		"read":        strconv.FormatBool(notification.Read),
	}
}

func NotificationFromStreamValues(values map[string]any) (Notification, error) {
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
		EditType:   streamValueAsString(values["edit_type"]),
		ObjectType: streamValueAsString(values["object_type"]),
		ObjectID:   objectID,
		Message:    streamValueAsString(values["message"]),
		Read:       read,
	}, nil
}

func streamValueAsString(value any) string {
	if value == nil {
		return ""
	}

	switch v := value.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		return fmt.Sprint(v)
	}
}

func prepareNotification(notification Notification) Notification {
	if notification.ID == uuid.Nil {
		notification.ID = uuid.New()
	}

	return notification
}

func (s *notificationStreamStore) Delete(ctx context.Context, userID uuid.UUID, redisIDs ...string) error {
    if s.rdb == nil {
        return ErrRedisIsNil
    }

	if len(redisIDs) == 0 {
		return nil
	}

	if err := s.rdb.XDel(ctx, s.streamKey(userID), redisIDs...).Err(); err != nil {
		return fmt.Errorf("delete notifications from redis stream: %w", err)
	}

	return nil
}