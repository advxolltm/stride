package notification

import (
	notificationdb "backend/db/notification"
	"context"
	"strings"

	"github.com/google/uuid"
)

const defaultNotificationRangeCount int64 = 1000

type Notification = notificationdb.Notification

type (
	NotificationService interface {
		SendNotification(ctx context.Context, userID uuid.UUID, objectType string, objectID uuid.UUID, message string) error
		GetNotifications(ctx context.Context, userID uuid.UUID) ([]Notification, error)
		MarkAsRead(ctx context.Context,userID uuid.UUID,notificationID uuid.UUID) error
	}
)

type notificationService struct {
	store notificationdb.NotificationStreamStore
}

func NewNotificationService(store notificationdb.NotificationStreamStore) NotificationService {
	return &notificationService{
		store: store,
	}
}

func (s *notificationService) SendNotification(ctx context.Context, userID uuid.UUID, objectType string, objectID uuid.UUID, message string) error {
	if s == nil || s.store == nil {
		return ErrNotificationStoreUnavailable
	}

	if userID == uuid.Nil {
		return ErrNotificationUserIDRequired
	}

	if strings.TrimSpace(objectType) == "" {
		return ErrNotificationObjectTypeRequired
	}

	if objectID == uuid.Nil {
		return ErrNotificationObjectIDRequired
	}

	if strings.TrimSpace(message) == "" {
		return ErrNotificationMessageRequired
	}
	
	notification := Notification{
		ID:         uuid.New(),
		UserID:     userID,
		ObjectType: objectType,
		ObjectID:   objectID,
		Message:    message,
		Read:       false,
	}

	_, err := s.store.Append(ctx, notification)
	return err
}




func (s *notificationService) GetNotifications(ctx context.Context, userID uuid.UUID) ([]Notification, error) {
	if s == nil || s.store == nil {
		return nil, ErrNotificationStoreUnavailable
	}

	if userID == uuid.Nil {
		return nil, ErrNotificationUserIDRequired
	}

	entries, err := s.store.Range(ctx, userID, "-", defaultNotificationRangeCount)
	if err != nil {
		return nil, err
	}

	return collapseNotifications(entries), nil
}

func (s *notificationService) MarkAsRead(ctx context.Context, userID uuid.UUID, notificationID uuid.UUID) error {
	if s == nil || s.store == nil {
		return ErrNotificationStoreUnavailable
	}

	if userID == uuid.Nil {
		return ErrNotificationUserIDRequired
	}

	if notificationID == uuid.Nil {
		return ErrNotificationIDRequired
	}

	notifications, err := s.GetNotifications(ctx, userID)
	if err != nil {
		return err
	}

	for _, notification := range notifications {
		if notification.ID != notificationID {
			continue
		}

		if notification.Read {
			return nil
		}

		notification.Read = true
		_, err = s.store.Append(ctx, notification)
		return err
	}

	return ErrNotificationNotFound
}

func collapseNotifications(entries []notificationdb.NotificationStreamEntry) []Notification {
	if len(entries) == 0 {
		return []Notification{}
	}

	notificationsByID := make(map[uuid.UUID]Notification, len(entries))
	order := make([]uuid.UUID, 0, len(entries))

	for _, entry := range entries {
		notification := entry.Notification
		if _, exists := notificationsByID[notification.ID]; !exists {
			order = append(order, notification.ID)
		}

		notificationsByID[notification.ID] = notification
	}

	result := make([]Notification, 0, len(order))
	for _, notificationID := range order {
		result = append(result, notificationsByID[notificationID])
	}

	return result
}