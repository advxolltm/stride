package chat

import (
	"backend/db/chat"
	"backend/models"
	"context"
	"fmt"

	"github.com/google/uuid"
)

type (
	ChatService interface {
		CreateMessage(ctx context.Context, message *models.Message) error
		UpdateMessage(ctx context.Context, messageID uuid.UUID, newContent string) (models.Message, error)
		DeleteMessage(ctx context.Context, messageID uuid.UUID) error
		GetProjectMessages(ctx context.Context, projectID uuid.UUID, offset int, count int) ([]models.Message, error)
		GetMessage(ctx context.Context, messageID uuid.UUID) (models.Message, error)
		GetMessageCount(ctx context.Context, projectID uuid.UUID) (int, error)
	}

	chatService struct {
		chatStore chat.ChatStore
	}
)


func NewChatService(chatStore chat.ChatStore) ChatService {
	return &chatService{chatStore}
}

// CreateMessage implements [ChatService].
func (s *chatService) CreateMessage(ctx context.Context, message *models.Message) error {
	err := s.chatStore.CreateMessage(ctx, message)
	if err != nil {
		return fmt.Errorf("failed to create a new chat message: %w", err)
	}
	return nil
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
func (s *chatService) GetProjectMessages(ctx context.Context, projectID uuid.UUID, offset int, count int) ([]models.Message, error) {
	messages, err := s.chatStore.GetProjectMessages(ctx, projectID, offset, count)
	if err != nil {
		return nil, fmt.Errorf("failed to get %d project messages for project %s at offset %d: %w", count, projectID, offset, err)
	}
	return messages, nil
}

// GetMessage implements [ChatService].
func (s *chatService) GetMessage(ctx context.Context, messageID uuid.UUID) (models.Message, error) {
	msg, err := s.chatStore.GetMessage(ctx, messageID)
	if err != nil {
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

