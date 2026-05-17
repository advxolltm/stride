package whiteboard

import (
	"backend/db/whiteboard"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type ElementBufferMeta struct {
	UserID      uuid.UUID
	ClientID    string
	OperationID string
}

type CreateElementInput struct {
	ElementType string
	Props       datatypes.JSON
	ZIndex      int
}

type BufferedElement struct {
	Op        *whiteboard.PendingElementOperation
	Collapsed bool
}

func (s *whiteboardService) requirePendingStore() error {
	if s.pendingStore == nil {
		return fmt.Errorf("whiteboard pending store not configured")
	}
	return nil
}

func (s *whiteboardService) resolveWhiteboardID(ctx context.Context, projectID uuid.UUID) (uuid.UUID, error) {
	wb, err := s.store.GetWhiteboardByProjectID(ctx, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return uuid.Nil, ErrWhiteboardNotFound
		}
		return uuid.Nil, err
	}
	return wb.ID, nil
}

func (s *whiteboardService) BufferCreateElement(
	ctx context.Context,
	projectID uuid.UUID,
	meta ElementBufferMeta,
	req CreateElementInput,
) (*BufferedElement, error) {
	if err := ValidateUserAccessToProject(ctx, s.projectService, meta.UserID, projectID); err != nil {
		return nil, err
	}
	if err := s.requirePendingStore(); err != nil {
		return nil, err
	}

	wbID, err := s.resolveWhiteboardID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	createdBy := meta.UserID
	zIdx := req.ZIndex
	now := time.Now().UTC()

	op := whiteboard.PendingElementOperation{
		ProjectID:    projectID,
		ElementID:    uuid.New(),
		WhiteboardID: wbID,
		Operation:    whiteboard.PendingElementCreate,
		CreatedBy:    &createdBy,
		ElementType:  req.ElementType,
		Props:        req.Props,
		ZIndex:       &zIdx,
		ClientID:     meta.ClientID,
		OperationID:  meta.OperationID,
		UpdatedAt:    now,
	}

	return s.bufferAndMark(ctx, projectID, op, now)
}

func (s *whiteboardService) BufferUpdateElement(
	ctx context.Context,
	projectID uuid.UUID,
	elementID uuid.UUID,
	meta ElementBufferMeta,
	fields whiteboard.UpdateElementFields,
) (*BufferedElement, error) {
	if err := ValidateUserAccessToProject(ctx, s.projectService, meta.UserID, projectID); err != nil {
		return nil, err
	}
	if err := s.requirePendingStore(); err != nil {
		return nil, err
	}

	wbID, err := s.resolveWhiteboardID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	op := whiteboard.PendingElementOperation{
		ProjectID:    projectID,
		ElementID:    elementID,
		WhiteboardID: wbID,
		Operation:    whiteboard.PendingElementUpdate,
		ClientID:     meta.ClientID,
		OperationID:  meta.OperationID,
		UpdatedAt:    now,
	}
	if fields.ElementType != nil {
		op.ElementType = *fields.ElementType
	}
	if fields.Props != nil {
		op.Props = *fields.Props
	}
	if fields.ZIndex != nil {
		op.ZIndex = fields.ZIndex
	}

	return s.bufferAndMark(ctx, projectID, op, now)
}

func (s *whiteboardService) BufferDeleteElement(
	ctx context.Context,
	projectID uuid.UUID,
	elementID uuid.UUID,
	meta ElementBufferMeta,
) (*BufferedElement, error) {
	if err := ValidateUserAccessToProject(ctx, s.projectService, meta.UserID, projectID); err != nil {
		return nil, err
	}
	if err := s.requirePendingStore(); err != nil {
		return nil, err
	}

	wbID, err := s.resolveWhiteboardID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	op := whiteboard.PendingElementOperation{
		ProjectID:    projectID,
		ElementID:    elementID,
		WhiteboardID: wbID,
		Operation:    whiteboard.PendingElementDelete,
		ClientID:     meta.ClientID,
		OperationID:  meta.OperationID,
		UpdatedAt:    now,
	}

	return s.bufferAndMark(ctx, projectID, op, now)
}

func (s *whiteboardService) bufferAndMark(
	ctx context.Context,
	projectID uuid.UUID,
	op whiteboard.PendingElementOperation,
	now time.Time,
) (*BufferedElement, error) {
	stored, collapsed, err := s.pendingStore.FoldPendingElementOperation(ctx, op)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrFoldPendingOperation, err)
	}
	if !collapsed {
		if err := s.pendingStore.MarkProjectPendingFlush(ctx, projectID, now); err != nil {
			return nil, fmt.Errorf("%w: %w", ErrMarkPendingFlush, err)
		}
	}
	return &BufferedElement{Op: stored, Collapsed: collapsed}, nil
}

func ElementFromPendingOp(op whiteboard.PendingElementOperation) models.WhiteboardElement {
	return elementFromPendingOp(op)
}
