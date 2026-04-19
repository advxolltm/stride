package whiteboard

import (
	"backend/db/whiteboard"
	"backend/models"
	"backend/services/auth"
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)



type (
	WhiteboardService interface {
		GetOrCreateWhiteboardByProjectID(ctx context.Context, projectID uuid.UUID) (*models.Whiteboard, error)
		GetWhiteboardByProjectID(ctx context.Context, projectUUID uuid.UUID) (*models.Whiteboard, error)
		CreateWhiteboard(ctx context.Context, whiteboard *models.Whiteboard) error
		UpdateWhiteboardByProjectID(ctx context.Context, id uuid.UUID, fields whiteboard.UpdateWhiteboardFields) (*models.Whiteboard, error)

		GetElements(ctx context.Context, projectID uuid.UUID) ([]models.WhiteboardElement, error)
		GetElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*models.WhiteboardElement, error)
		CreateElement(ctx context.Context, projectID uuid.UUID, element *models.WhiteboardElement) (*models.WhiteboardElement, error)
		UpdateElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID, fields whiteboard.UpdateElementFields) (*models.WhiteboardElement, error)
		DeleteElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error
	}
		
	whiteboardService struct {
		store whiteboard.WhiteboardStore
		authService auth.AuthService
	}	
)

func NewWhiteboardService(store whiteboard.WhiteboardStore, authService auth.AuthService) WhiteboardService {
	return &whiteboardService{store: store, authService: authService}
}

func ValidateUserAccessToProject(ctx context.Context, authService auth.AuthService, projectID uuid.UUID) error {
	//TODO: This function is duplicated in project.service.go, consider refactoring to a shared location
	//TODO: switch to using Redis cache for project membership checks to improve performance
	userID, ok := ctx.Value("userID").(uuid.UUID)
	if !ok || userID == uuid.Nil {
		return auth.ErrUserIDNotInContext
	}

	_, validationErr := authService.IsProjectMember(ctx, userID, projectID)
	if validationErr != nil {
		return auth.ErrAccessDenied
	}
	return nil
}


func (s *whiteboardService) GetOrCreateWhiteboardByProjectID(ctx context.Context, projectID uuid.UUID) (*models.Whiteboard, error) {
	err := ValidateUserAccessToProject(ctx, s.authService, projectID)
	if err != nil {
		return nil, err
	}

	whiteboard, err := s.GetWhiteboardByProjectID(ctx, projectID)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		whiteboard = &models.Whiteboard{ProjectID: projectID}
		if err = s.CreateWhiteboard(ctx, whiteboard); err != nil {
			return nil, ErrCreateWhiteboardFailed
		}
	}
	return whiteboard, nil
}


func (s *whiteboardService) GetWhiteboardByProjectID(ctx context.Context, projectUUID uuid.UUID) (*models.Whiteboard, error){
	return s.store.GetWhiteboardByProjectID(ctx, projectUUID)
}


func (s *whiteboardService) CreateWhiteboard(ctx context.Context, whiteboard *models.Whiteboard) error {
	return s.store.CreateWhiteboard(ctx, whiteboard)
}




func (s *whiteboardService) UpdateWhiteboardByProjectID(ctx context.Context, projectID uuid.UUID, fields whiteboard.UpdateWhiteboardFields) (*models.Whiteboard, error) {
    err := ValidateUserAccessToProject(ctx, s.authService, projectID)
	if err != nil {
		return nil, err
	}
    return s.store.UpdateWhiteboardByProjectID(ctx, projectID, fields)
}

func (s *whiteboardService) GetElements(ctx context.Context, projectID uuid.UUID) ([]models.WhiteboardElement, error) {
	if err := ValidateUserAccessToProject(ctx, s.authService, projectID); err != nil {
		return nil, err
	}
	return s.store.GetElements(ctx, projectID)
}

func (s *whiteboardService) GetElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*models.WhiteboardElement, error) {
	if err := ValidateUserAccessToProject(ctx, s.authService, projectID); err != nil {
		return nil, err
	}
	return s.store.GetElement(ctx, projectID, id)
}

func (s *whiteboardService) CreateElement(ctx context.Context, projectID uuid.UUID, element *models.WhiteboardElement) (*models.WhiteboardElement, error) {
	if err := ValidateUserAccessToProject(ctx, s.authService, projectID); err != nil {
		return nil, err
	}
	wb, err := s.store.GetWhiteboardByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	element.WhiteboardID = wb.ID
	return s.store.CreateElement(ctx, element)
}

func (s *whiteboardService) UpdateElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID, fields whiteboard.UpdateElementFields) (*models.WhiteboardElement, error) {
	if err := ValidateUserAccessToProject(ctx, s.authService, projectID); err != nil {
		return nil, err
	}
	return s.store.UpdateElement(ctx, projectID, id, fields)
}

func (s *whiteboardService) DeleteElement(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	if err := ValidateUserAccessToProject(ctx, s.authService, projectID); err != nil {
		return err
	}
	return s.store.DeleteElement(ctx, projectID, id)
}

