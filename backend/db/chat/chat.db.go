package chat

import (
	"backend/db"
	"backend/models"
	"context"
	"math"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type (
	ChatStore interface {
		CreateMessage(ctx context.Context, message *models.Message) error
		UpdateMessage(ctx context.Context, messageID uuid.UUID, newContent string) (models.Message, error)
		DeleteMessage(ctx context.Context, messageID uuid.UUID) error
		GetProjectMessages(ctx context.Context, projectID uuid.UUID, page, pageSize int) (db.Paginated[models.Message], error)
		GetMessage(ctx context.Context, messageID uuid.UUID) (models.Message, error)
		GetMessageCount(ctx context.Context, projectID uuid.UUID) (int, error)
		GetProjectChatCursors(ctx context.Context, projectID uuid.UUID) ([]models.ChatMemberCursor, error)
		MarkDelivered(ctx context.Context, projectID uuid.UUID, projectMemberID uuid.UUID, messageID uuid.UUID) (models.ChatMemberCursor, error)
		MarkRead(ctx context.Context, projectID uuid.UUID, projectMemberID uuid.UUID, messageID uuid.UUID) (models.ChatMemberCursor, error)
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
		Where("project_id = ? and is_deleted = false", projectID).
		Count(&count).
		Error
	if err != nil {
		return 0, err
	}

	// we happily assume that a project chat contains less than 2 billion messages :)
	return int(count), nil
}

// GetProjectChatCursors implements [ChatStore].
func (s *chatStore) GetProjectChatCursors(ctx context.Context, projectID uuid.UUID) ([]models.ChatMemberCursor, error) {
	var cursors []models.ChatMemberCursor
	err := s.db.
		WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("updated_at ASC").
		Find(&cursors).
		Error
	if err != nil {
		return nil, err
	}

	return cursors, nil
}

// MarkDelivered implements [ChatStore].
func (s *chatStore) MarkDelivered(ctx context.Context, projectID uuid.UUID, projectMemberID uuid.UUID, messageID uuid.UUID) (models.ChatMemberCursor, error) {
	message, err := s.getProjectCursorMessage(ctx, projectID, messageID)
	if err != nil {
		return models.ChatMemberCursor{}, err
	}

	now := time.Now()
	cursor := models.ChatMemberCursor{
		ProjectID:                     projectID,
		ProjectMemberID:               projectMemberID,
		LastDeliveredMessageID:        message.ID,
		LastDeliveredMessageCreatedAt: message.CreatedAt,
		DeliveredAt:                   now,
		UpdatedAt:                     now,
	}

	err = s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "project_id"},
			{Name: "project_member_id"},
		},
		DoUpdates: clause.Assignments(map[string]any{
			"last_delivered_message_id":         cursor.LastDeliveredMessageID,
			"last_delivered_message_created_at": cursor.LastDeliveredMessageCreatedAt,
			"delivered_at":                      cursor.DeliveredAt,
			"updated_at":                        cursor.UpdatedAt,
		}),
		Where: clause.Where{Exprs: []clause.Expression{
			clause.Expr{
				SQL: "chat_member_cursors.last_delivered_message_created_at < EXCLUDED.last_delivered_message_created_at",
			},
		}},
	}).Create(&cursor).Error
	if err != nil {
		return models.ChatMemberCursor{}, err
	}

	return s.getProjectMemberCursor(ctx, projectID, projectMemberID)
}

// MarkRead implements [ChatStore].
func (s *chatStore) MarkRead(ctx context.Context, projectID uuid.UUID, projectMemberID uuid.UUID, messageID uuid.UUID) (models.ChatMemberCursor, error) {
	message, err := s.getProjectCursorMessage(ctx, projectID, messageID)
	if err != nil {
		return models.ChatMemberCursor{}, err
	}

	now := time.Now()
	cursor := models.ChatMemberCursor{
		ProjectID:                     projectID,
		ProjectMemberID:               projectMemberID,
		LastDeliveredMessageID:        message.ID,
		LastDeliveredMessageCreatedAt: message.CreatedAt,
		DeliveredAt:                   now,
		LastReadMessageID:             &message.ID,
		LastReadMessageCreatedAt:      &message.CreatedAt,
		ReadAt:                        &now,
		UpdatedAt:                     now,
	}

	err = s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "project_id"},
			{Name: "project_member_id"},
		},
		DoUpdates: clause.Assignments(map[string]any{
			"last_delivered_message_id": gorm.Expr(
				"CASE WHEN chat_member_cursors.last_delivered_message_created_at < EXCLUDED.last_delivered_message_created_at THEN EXCLUDED.last_delivered_message_id ELSE chat_member_cursors.last_delivered_message_id END",
			),
			"last_delivered_message_created_at": gorm.Expr(
				"CASE WHEN chat_member_cursors.last_delivered_message_created_at < EXCLUDED.last_delivered_message_created_at THEN EXCLUDED.last_delivered_message_created_at ELSE chat_member_cursors.last_delivered_message_created_at END",
			),
			"delivered_at": gorm.Expr(
				"CASE WHEN chat_member_cursors.last_delivered_message_created_at < EXCLUDED.last_delivered_message_created_at THEN EXCLUDED.delivered_at ELSE chat_member_cursors.delivered_at END",
			),
			"last_read_message_id":         cursor.LastReadMessageID,
			"last_read_message_created_at": cursor.LastReadMessageCreatedAt,
			"read_at":                      cursor.ReadAt,
			"updated_at":                   cursor.UpdatedAt,
		}),
		Where: clause.Where{Exprs: []clause.Expression{
			clause.Expr{
				SQL: "chat_member_cursors.last_read_message_created_at IS NULL OR chat_member_cursors.last_read_message_created_at < EXCLUDED.last_read_message_created_at",
			},
		}},
	}).Create(&cursor).Error
	if err != nil {
		return models.ChatMemberCursor{}, err
	}

	return s.getProjectMemberCursor(ctx, projectID, projectMemberID)
}

// GetProjectMessages implements [ChatStore].
func (s *chatStore) GetProjectMessages(ctx context.Context, projectID uuid.UUID, page, pageSize int) (db.Paginated[models.Message], error) {
	var messages []models.Message
	numElements, err := s.GetMessageCount(ctx, projectID)
	if err != nil {
		return db.Paginated[models.Message]{}, err
	}

	pageCount := int(math.Ceil(float64(numElements) / float64(pageSize)))

	var actualPage int

	// if page == 0 -> select last page
	if page == 0 {
		actualPage = pageCount
	} else {
		actualPage = page
	}

	offset := (actualPage - 1) * pageSize

	err = s.db.
		WithContext(ctx).
		Debug().
		Where("project_id = ? and is_deleted = false", projectID).
		Order("created_at ASC").
		Offset(offset).
		Limit(pageSize).
		Find(&messages).
		Error
	if err != nil {
		return db.Paginated[models.Message]{}, err
	}

	paginated := db.Paginated[models.Message]{
		Items:          messages,
		Page:           actualPage,
		PageSize:       pageSize,
		PageCount:      pageCount,
		TotalItemCount: numElements,
	}

	return paginated, nil
}

// GetMessage implements [ChatStore]
func (s *chatStore) GetMessage(ctx context.Context, messageID uuid.UUID) (models.Message, error) {
	var msg models.Message
	err := s.db.WithContext(ctx).First(&msg, "id = ?", messageID).Error
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

func (s *chatStore) getProjectCursorMessage(ctx context.Context, projectID uuid.UUID, messageID uuid.UUID) (models.Message, error) {
	var message models.Message
	err := s.db.
		WithContext(ctx).
		First(&message, "id = ? AND project_id = ? AND is_deleted = false", messageID, projectID).
		Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return models.Message{}, ErrMessageNotFound
		}
		return models.Message{}, err
	}

	return message, nil
}

func (s *chatStore) getProjectMemberCursor(ctx context.Context, projectID uuid.UUID, projectMemberID uuid.UUID) (models.ChatMemberCursor, error) {
	var cursor models.ChatMemberCursor
	err := s.db.
		WithContext(ctx).
		First(&cursor, "project_id = ? AND project_member_id = ?", projectID, projectMemberID).
		Error
	if err != nil {
		return models.ChatMemberCursor{}, err
	}

	return cursor, nil
}
