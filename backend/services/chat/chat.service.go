package chat

import (
	"backend/db"
	dbChat "backend/db/chat"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type (
	ChatService interface {
		CreateMessage(ctx context.Context, content string, sentBy models.ProjectMember) (models.Message, error)
		UpdateMessage(ctx context.Context, messageID uuid.UUID, newContent string) (models.Message, error)
		DeleteMessage(ctx context.Context, messageID uuid.UUID) error
		GetProjectMessages(ctx context.Context, projectID uuid.UUID, page, pageSize int) (db.Paginated[models.Message], error)
		GetMessage(ctx context.Context, messageID uuid.UUID) (models.Message, error)
		GetMessageCount(ctx context.Context, projectID uuid.UUID) (int, error)
		GetProjectChatCursors(ctx context.Context, projectID uuid.UUID) ([]models.ChatMemberCursor, error)
		MarkDelivered(ctx context.Context, projectID uuid.UUID, projectMemberID uuid.UUID, messageID uuid.UUID) (models.ChatMemberCursor, error)
		MarkRead(ctx context.Context, projectID uuid.UUID, projectMemberID uuid.UUID, messageID uuid.UUID) (models.ChatMemberCursor, error)
	}

	chatService struct {
		chatStore dbChat.ChatStore
	}
)

func NewChatService(chatStore dbChat.ChatStore) ChatService {
	return &chatService{chatStore}
}

// CreateMessage implements [ChatService].
func (s *chatService) CreateMessage(ctx context.Context, content string, sentBy models.ProjectMember) (models.Message, error) {
	msg := models.Message{
		SenderID:  &sentBy.ID,
		ProjectID: sentBy.ProjectID,
		Content:   content,
		IsEdited:  false,
		IsDeleted: false,
		CreatedAt: time.Now(),
		EditedAt:  nil,
		DeletedAt: nil,
	}
	err := s.chatStore.CreateMessage(ctx, &msg)
	if err != nil {
		return models.Message{}, fmt.Errorf("failed to create a new chat message: %w", err)
	}
	return msg, nil
}

// DeleteMessage implements [ChatService].
func (s *chatService) DeleteMessage(ctx context.Context, messageID uuid.UUID) error {
	err := s.chatStore.DeleteMessage(ctx, messageID)
	if err != nil {
		return fmt.Errorf("failed to delete message %s: %w", messageID, err)
	}
	return nil
}

// GetMessageCount implements [ChatService].
func (s *chatService) GetMessageCount(ctx context.Context, projectID uuid.UUID) (int, error) {
	count, err := s.chatStore.GetMessageCount(ctx, projectID)
	if err != nil {
		return 0, fmt.Errorf("failed to get message count for project %s: %w", projectID, err)
	}
	return count, nil
}

// GetProjectMessages implements [ChatService].
func (s *chatService) GetProjectMessages(ctx context.Context, projectID uuid.UUID, page, pageSize int) (db.Paginated[models.Message], error) {
	messages, err := s.chatStore.GetProjectMessages(ctx, projectID, page, pageSize)
	if err != nil {
		return db.Paginated[models.Message]{}, fmt.Errorf("failed to get %d project messages for project %s at page %d: %w", pageSize, projectID, page, err)
	}
	return messages, nil
}

// GetMessage implements [ChatService].
func (s *chatService) GetMessage(ctx context.Context, messageID uuid.UUID) (models.Message, error) {
	msg, err := s.chatStore.GetMessage(ctx, messageID)
	if err != nil {
		if errors.Is(err, dbChat.ErrMessageNotFound) {
			return models.Message{}, fmt.Errorf("%w: %w", ErrMessageNotFound, err)
		}
		return models.Message{}, fmt.Errorf("failed to get message %s: %w", messageID, err)
	}
	return msg, nil
}

// UpdateMessage implements [ChatService].
func (s *chatService) UpdateMessage(ctx context.Context, messageID uuid.UUID, newContent string) (models.Message, error) {
	msg, err := s.chatStore.UpdateMessage(ctx, messageID, newContent)
	if err != nil {
		return models.Message{}, fmt.Errorf("failed to update message %s: %w", messageID, err)
	}
	return msg, nil
}

// GetProjectChatCursors implements [ChatService].
func (s *chatService) GetProjectChatCursors(ctx context.Context, projectID uuid.UUID) ([]models.ChatMemberCursor, error) {
	cursor, err := s.chatStore.GetProjectChatCursors(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to get chat cursors for project %s: %w", projectID, err)
	}

	return cursor, nil
}

// MarkDelivered implements [ChatService].
func (s *chatService) MarkDelivered(ctx context.Context, projectID uuid.UUID, projectMemberID uuid.UUID, messageID uuid.UUID) (models.ChatMemberCursor, error) {
	cursor, err := s.chatStore.MarkDelivered(ctx, projectID, projectMemberID, messageID)
	if err != nil {
		if errors.Is(err, dbChat.ErrMessageNotFound) {
			return models.ChatMemberCursor{}, fmt.Errorf("%w: %w", ErrMessageNotFound, err)
		}
		return models.ChatMemberCursor{}, fmt.Errorf("failed to mark message %s as delivered for project member %s: %w", messageID, projectMemberID, err)
	}
	return cursor, nil
}

// MarkRead implements [ChatService].
func (s *chatService) MarkRead(ctx context.Context, projectID uuid.UUID, projectMemberID uuid.UUID, messageID uuid.UUID) (models.ChatMemberCursor, error) {
	cursor, err := s.chatStore.MarkRead(ctx, projectID, projectMemberID, messageID)
	if err != nil {
		if errors.Is(err, dbChat.ErrMessageNotFound) {
			return models.ChatMemberCursor{}, fmt.Errorf("%w: %w", ErrMessageNotFound, err)
		}
		return models.ChatMemberCursor{}, fmt.Errorf("failed to mark message %s as read for project member %s: %w", messageID, projectMemberID, err)
	}
	return cursor, nil
}
