package whiteboard

import (
	"backend/models"
	"context"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)


type (
	WhiteboardStore interface {
		GetWhiteboardByProjectID(ctx context.Context, projectUUID uuid.UUID) (*models.Whiteboard, error)
		CreateWhiteboard(ctx context.Context, whiteboard *models.Whiteboard) error
		UpdateWhiteboard(ctx context.Context, id uuid.UUID, fields UpdateWhiteboardFields) (*models.Whiteboard, error)

		GetElements(ctx context.Context, whiteboardID uuid.UUID) ([]models.WhiteboardElement, error)
		GetElement(ctx context.Context, id uuid.UUID) (*models.WhiteboardElement, error)
		CreateElement(ctx context.Context, element *models.WhiteboardElement) (*models.WhiteboardElement, error)
		UpdateElement(ctx context.Context, id uuid.UUID, fields UpdateElementFields) (*models.WhiteboardElement, error)
		DeleteElement(ctx context.Context, id uuid.UUID) error
	}

	UpdateWhiteboardFields struct {
		CanvasState *datatypes.JSON `gorm:"column:canvas_state"`
	}
	UpdateElementFields struct {
		ElementType *string         `gorm:"column:element_type"`
		Props       *datatypes.JSON `gorm:"column:props"`
		ZIndex      *int            `gorm:"column:z_index"`
	}
	whiteboardStore struct {
		db *gorm.DB
	}
)

func NewWhiteboardStore(db *gorm.DB) WhiteboardStore {
	return &whiteboardStore{db: db}
}

func (s *whiteboardStore) GetWhiteboardByProjectID(ctx context.Context, projectUUID uuid.UUID) (*models.Whiteboard, error) {
	var whiteboard models.Whiteboard
	result := s.db.WithContext(ctx).First(&whiteboard, "project_id = ?", projectUUID)
	if result.Error != nil {
		return nil, result.Error
	}
	return &whiteboard, nil
}

func (s *whiteboardStore) CreateWhiteboard(ctx context.Context, whiteboard *models.Whiteboard) error {
	result := s.db.WithContext(ctx).Create(whiteboard)
	return result.Error
}

func (s *whiteboardStore) UpdateWhiteboard(ctx context.Context, id uuid.UUID, fields UpdateWhiteboardFields) (*models.Whiteboard, error) {
	var whiteboard models.Whiteboard
	result := s.db.WithContext(ctx).Model(&whiteboard).Where("id = ?", id).Updates(fields).First(&whiteboard)
	if result.Error != nil {
		return nil, result.Error
	}
	return &whiteboard, nil
}


func (s *whiteboardStore) GetElement(ctx context.Context, id uuid.UUID) (*models.WhiteboardElement, error) {
	var element models.WhiteboardElement
	result := s.db.WithContext(ctx).First(&element, "id = ?", id)
	if result.Error != nil {
		return nil, result.Error
	}
	return &element, nil
}

func (s *whiteboardStore) GetElements(ctx context.Context, whiteboardID uuid.UUID) ([]models.WhiteboardElement, error) {
	var elements []models.WhiteboardElement
	result := s.db.WithContext(ctx).Where("whiteboard_id = ?", whiteboardID).Find(&elements)
	if result.Error != nil {
		return nil, result.Error
	}
	return elements, nil
}

func (s *whiteboardStore) CreateElement(ctx context.Context, element *models.WhiteboardElement) (*models.WhiteboardElement, error){
	result := s.db.WithContext(ctx).Create(element)
	if result.Error != nil {
		return nil, result.Error
	}
	return element, nil
}

func (s *whiteboardStore) UpdateElement(ctx context.Context, id uuid.UUID, fields UpdateElementFields) (*models.WhiteboardElement, error) {
	var element models.WhiteboardElement
	result := s.db.WithContext(ctx).Model(&element).Where("id = ?", id).Updates(fields).First(&element)
	if result.Error != nil {
		return nil, result.Error
	}
	return &element, nil
}

func (s *whiteboardStore) DeleteElement(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).Delete(&models.WhiteboardElement{}, "id = ?", id)
	return result.Error
}