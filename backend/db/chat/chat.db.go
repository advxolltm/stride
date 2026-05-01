package chat

import (
	"backend/models"
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type (
	ChatStore interface {
		CreateMessage(ctx context.Context, message *models.Message) error
		UpdateMessage(ctx context.Context, messageID uuid.UUID, newContent string) (models.Message, error)
		DeleteMessage(ctx context.Context, messageID uuid.UUID) error
		GetProjectMessages(ctx context.Context, projectID uuid.UUID, offset int, count int) ([]models.Message, error)
		GetMessage(ctx context.Context, messageID uuid.UUID) (models.Message, error)
		GetMessageCount(ctx context.Context, projectID uuid.UUID) (int, error)
	}

	chatStore struct {
		db *gorm.DB
	}
)

func NewChatStore(db *gorm.DB) ChatStore {
	return &chatStore{db}
}

// CreateMessage implements [ChatStore].
func (s *chatStore) CreateMessage(ctx context.Context, message *models.Message) error {
	return s.db.WithContext(ctx).Create(message).Error
}

// DeleteMessage implements [ChatStore].
func (s *chatStore) DeleteMessage(ctx context.Context, messageID uuid.UUID) error {
	return s.db.
		WithContext(ctx).
		Model(&models.Message{}).
		Where("id = ?", messageID).
		Updates(map[string]any{
			"content":    "",
			"is_deleted": true,
			"deleted_at": time.Now(),
		}).
		Error
}

// GetMessageCount implements [ChatStore].
func (s *chatStore) GetMessageCount(ctx context.Context, projectID uuid.UUID) (int, error) {
	var count int64
	err := s.db.
		WithContext(ctx).
		Model(&models.Message{}).
		Where("project_id = ?", projectID).
		Count(&count).
		Error
	if err != nil {
		return 0, err
	}

	// we happily assume that a project chat contains less than 2 billion messages :)
	return int(count), nil
}

// GetProjectMessages implements [ChatStore].
func (s *chatStore) GetProjectMessages(ctx context.Context, projectID uuid.UUID, offset int, count int) ([]models.Message, error) {
	var messages []models.Message
	err := s.db.
		WithContext(ctx).
		Offset(offset).
		Limit(count).
		Find(&messages).
		Error
	if err != nil {
		return nil, err
	}
	return messages, nil
}

// GetMessage implements [ChatStore]
func (s *chatStore) GetMessage(ctx context.Context, messageID uuid.UUID) (models.Message, error) {
	var msg models.Message
	err := s.db.WithContext(ctx).Find(&msg, "id = ?", messageID).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return models.Message{}, ErrMessageNotFound
		}
		return models.Message{}, err
	}
	return msg, nil
}

// UpdateMessage implements [ChatStore].
func (s *chatStore) UpdateMessage(ctx context.Context, messageID uuid.UUID, newContent string) (models.Message, error) {
	msg := models.Message{
		ID: messageID,
	}

	err := s.db.
		WithContext(ctx).
		Model(&msg).
		Where("id = ?", messageID).
		Updates(map[string]any{
			"content":   newContent,
			"is_edited": true,
			"edited_at": time.Now(),
		}).
		Error

	if err != nil {
		return models.Message{}, err
	}

	return msg, nil
}
