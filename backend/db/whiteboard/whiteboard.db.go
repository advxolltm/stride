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
		UpdateWhiteboardByProjectID(ctx context.Context, projectUUID uuid.UUID, fields UpdateWhiteboardFields) (*models.Whiteboard, error)
		CreateWhiteboard(ctx context.Context, whiteboard *models.Whiteboard) error
		GetElements(ctx context.Context, projectID uuid.UUID) ([]models.WhiteboardElement, error)
		GetElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*models.WhiteboardElement, error)
		CreateElement(ctx context.Context, element *models.WhiteboardElement) (*models.WhiteboardElement, error)
		UpdateElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID, fields UpdateElementFields) (*models.WhiteboardElement, error)
		DeleteElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error
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

func (s *whiteboardStore) UpdateWhiteboardByProjectID(ctx context.Context, projectUUID uuid.UUID, fields UpdateWhiteboardFields) (*models.Whiteboard, error) {
	var whiteboard models.Whiteboard
	result := s.db.WithContext(ctx).Model(&whiteboard).Where("project_id = ?", projectUUID).Updates(fields).First(&whiteboard)
	if result.Error != nil {
		return nil, result.Error
	}
	return &whiteboard, nil
}

func (s *whiteboardStore) GetElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*models.WhiteboardElement, error) {
	var element models.WhiteboardElement
	result := s.db.WithContext(ctx).
		Joins("JOIN whiteboards ON whiteboards.id = whiteboard_elements.whiteboard_id").
		Where("whiteboard_elements.id = ? AND whiteboards.project_id = ?", id, projectID).
		First(&element)
	if result.Error != nil {
		return nil, result.Error
	}
	return &element, nil
}

func (s *whiteboardStore) GetElements(ctx context.Context, projectID uuid.UUID) ([]models.WhiteboardElement, error) {
	var elements []models.WhiteboardElement
	result := s.db.WithContext(ctx).
		Joins("JOIN whiteboards ON whiteboards.id = whiteboard_elements.whiteboard_id").
		Where("whiteboards.project_id = ?", projectID).
		Find(&elements)
	if result.Error != nil {
		return nil, result.Error
	}
	return elements, nil
}

func (s *whiteboardStore) CreateElement(ctx context.Context, element *models.WhiteboardElement) (*models.WhiteboardElement, error) {
	result := s.db.WithContext(ctx).Create(element)
	if result.Error != nil {
		return nil, result.Error
	}
	return element, nil
}

func (s *whiteboardStore) UpdateElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID, fields UpdateElementFields) (*models.WhiteboardElement, error) {
	result := s.db.WithContext(ctx).Model(&models.WhiteboardElement{}).
		Where("id = ? AND whiteboard_id = (SELECT id FROM whiteboards WHERE project_id = ?)", id, projectID).
		Updates(fields)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var element models.WhiteboardElement
	if err := s.db.WithContext(ctx).First(&element, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &element, nil
}

func (s *whiteboardStore) DeleteElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	result := s.db.WithContext(ctx).
		Where("id = ? AND whiteboard_id = (SELECT id FROM whiteboards WHERE project_id = ?)", id, projectID).
		Delete(&models.WhiteboardElement{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
