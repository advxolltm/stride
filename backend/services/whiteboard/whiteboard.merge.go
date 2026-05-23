package whiteboard

import (
	"sort"

	whiteboardDB "backend/db/whiteboard"
	"backend/models"

	"github.com/google/uuid"
)

func MergePendingOperations(
	elements []models.WhiteboardElement,
	ops []whiteboardDB.PendingElementOperation,
) []models.WhiteboardElement {
	indexed := make(map[uuid.UUID]models.WhiteboardElement, len(elements)+len(ops))
	for _, el := range elements {
		indexed[el.ID] = el
	}

	for _, op := range ops {
		switch op.Operation {
		case whiteboardDB.PendingElementDelete:
			delete(indexed, op.ElementID)

		case whiteboardDB.PendingElementCreate:
			indexed[op.ElementID] = elementFromPendingOp(op)

		case whiteboardDB.PendingElementUpdate:
			existing, ok := indexed[op.ElementID]
			if !ok {
				continue
			}
			indexed[op.ElementID] = applyPendingUpdate(existing, op)
		}
	}

	out := make([]models.WhiteboardElement, 0, len(indexed))
	for _, el := range indexed {
		out = append(out, el)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].ZIndex != out[j].ZIndex {
			return out[i].ZIndex < out[j].ZIndex
		}
		// Deterministic tiebreaker so identical zIndex values do not flap.
		return out[i].ID.String() < out[j].ID.String()
	})
	return out
}

func elementFromPendingOp(op whiteboardDB.PendingElementOperation) models.WhiteboardElement {
	z := 0
	if op.ZIndex != nil {
		z = *op.ZIndex
	}
	return models.WhiteboardElement{
		ID:           op.ElementID,
		WhiteboardID: op.WhiteboardID,
		CreatedBy:    op.CreatedBy,
		ElementType:  op.ElementType,
		Props:        op.Props,
		ZIndex:       z,
		CreatedAt:    op.UpdatedAt,
		UpdatedAt:    op.UpdatedAt,
	}
}

func applyPendingUpdate(el models.WhiteboardElement, op whiteboardDB.PendingElementOperation) models.WhiteboardElement {
	if op.ElementType != "" {
		el.ElementType = op.ElementType
	}
	if len(op.Props) > 0 {
		el.Props = op.Props
	}
	if op.ZIndex != nil {
		el.ZIndex = *op.ZIndex
	}
	if !op.UpdatedAt.IsZero() {
		el.UpdatedAt = op.UpdatedAt
	}
	return el
}
