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

type UpdateElementInput struct {
	ElementID   uuid.UUID
	ElementType *string
	Props       *datatypes.JSON
	ZIndex      *int
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

func (s *whiteboardService) BufferCreateElements(
	ctx context.Context,
	projectID uuid.UUID,
	meta ElementBufferMeta,
	reqs []CreateElementInput,
) ([]models.WhiteboardElement, error) {
	if len(reqs) == 0 {
		return nil, nil
	}
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
	now := time.Now().UTC()
	ops := make([]whiteboard.PendingElementOperation, 0, len(reqs))
	for _, req := range reqs {
		zIdx := req.ZIndex
		ops = append(ops, whiteboard.PendingElementOperation{
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
		})
	}

	stored, collapsed, err := s.bufferBatchAndMark(ctx, projectID, ops, now)
	if err != nil {
		return nil, err
	}

	elements := make([]models.WhiteboardElement, 0, len(stored))
	for index, op := range stored {
		if op == nil || collapsed[index] {
			continue
		}
		elements = append(elements, ElementFromPendingOp(*op))
	}
	return elements, nil
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

func (s *whiteboardService) BufferUpdateElements(
	ctx context.Context,
	projectID uuid.UUID,
	meta ElementBufferMeta,
	reqs []UpdateElementInput,
) ([]models.WhiteboardElement, error) {
	if len(reqs) == 0 {
		return nil, nil
	}
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
	ops := make([]whiteboard.PendingElementOperation, 0, len(reqs))
	for _, req := range reqs {
		op := whiteboard.PendingElementOperation{
			ProjectID:    projectID,
			ElementID:    req.ElementID,
			WhiteboardID: wbID,
			Operation:    whiteboard.PendingElementUpdate,
			ClientID:     meta.ClientID,
			OperationID:  meta.OperationID,
			UpdatedAt:    now,
		}
		if req.ElementType != nil {
			op.ElementType = *req.ElementType
		}
		if req.Props != nil {
			op.Props = *req.Props
		}
		if req.ZIndex != nil {
			op.ZIndex = req.ZIndex
		}
		ops = append(ops, op)
	}

	stored, collapsed, err := s.bufferBatchAndMark(ctx, projectID, ops, now)
	if err != nil {
		return nil, err
	}

	elements := make([]models.WhiteboardElement, 0, len(stored))
	for index, op := range stored {
		if op == nil || collapsed[index] || op.Operation == whiteboard.PendingElementDelete {
			continue
		}
		elements = append(elements, ElementFromPendingOp(*op))
	}
	return elements, nil
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

func (s *whiteboardService) BufferDeleteElements(
	ctx context.Context,
	projectID uuid.UUID,
	elementIDs []uuid.UUID,
	meta ElementBufferMeta,
) error {
	if len(elementIDs) == 0 {
		return nil
	}
	if err := ValidateUserAccessToProject(ctx, s.projectService, meta.UserID, projectID); err != nil {
		return err
	}
	if err := s.requirePendingStore(); err != nil {
		return err
	}

	wbID, err := s.resolveWhiteboardID(ctx, projectID)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	ops := make([]whiteboard.PendingElementOperation, 0, len(elementIDs))
	for _, elementID := range elementIDs {
		ops = append(ops, whiteboard.PendingElementOperation{
			ProjectID:    projectID,
			ElementID:    elementID,
			WhiteboardID: wbID,
			Operation:    whiteboard.PendingElementDelete,
			ClientID:     meta.ClientID,
			OperationID:  meta.OperationID,
			UpdatedAt:    now,
		})
	}

	_, _, err = s.bufferBatchAndMark(ctx, projectID, ops, now)
	return err
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

func (s *whiteboardService) bufferBatchAndMark(
	ctx context.Context,
	projectID uuid.UUID,
	ops []whiteboard.PendingElementOperation,
	now time.Time,
) ([]*whiteboard.PendingElementOperation, []bool, error) {
	stored, collapsed, err := s.pendingStore.FoldPendingElementOperations(ctx, ops)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: %w", ErrFoldPendingOperation, err)
	}
	if hasUncollapsedBufferedElement(collapsed) {
		if err := s.pendingStore.MarkProjectPendingFlush(ctx, projectID, now); err != nil {
			return nil, nil, fmt.Errorf("%w: %w", ErrMarkPendingFlush, err)
		}
	}
	return stored, collapsed, nil
}

func hasUncollapsedBufferedElement(collapsed []bool) bool {
	for _, item := range collapsed {
		if !item {
			return true
		}
	}
	return false
}

func ElementFromPendingOp(op whiteboard.PendingElementOperation) models.WhiteboardElement {
	return elementFromPendingOp(op)
}
