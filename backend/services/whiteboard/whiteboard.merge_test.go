package whiteboard_test

import (
	"testing"
	"time"

	whiteboardDB "backend/db/whiteboard"
	"backend/models"
	whiteboardSvc "backend/services/whiteboard"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
)

func intPtr(v int) *int { return &v }

func makeDBElement(id uuid.UUID, etype string, props string, z int) models.WhiteboardElement {
	return models.WhiteboardElement{
		ID:          id,
		ElementType: etype,
		Props:       datatypes.JSON([]byte(props)),
		ZIndex:      z,
	}
}

func TestMergePendingOperations_EmptyOps_ReturnsSortedDB(t *testing.T) {
	a := makeDBElement(uuid.New(), "rect", `{"id":"a"}`, 2)
	b := makeDBElement(uuid.New(), "rect", `{"id":"b"}`, 1)

	got := whiteboardSvc.MergePendingOperations([]models.WhiteboardElement{a, b}, nil)

	require.Len(t, got, 2)
	assert.Equal(t, b.ID, got[0].ID, "ZIndex=1 must come before ZIndex=2")
	assert.Equal(t, a.ID, got[1].ID)
}

func TestMergePendingOperations_CreateOverlay_AddsElement(t *testing.T) {
	existing := makeDBElement(uuid.New(), "rect", `{"id":"a"}`, 0)
	newID := uuid.New()
	wbID := uuid.New()
	ops := []whiteboardDB.PendingElementOperation{{
		ElementID:    newID,
		WhiteboardID: wbID,
		Operation:    whiteboardDB.PendingElementCreate,
		ElementType:  "ellipse",
		Props:        datatypes.JSON([]byte(`{"id":"e1"}`)),
		ZIndex:       intPtr(5),
		UpdatedAt:    time.Now().UTC(),
	}}

	got := whiteboardSvc.MergePendingOperations([]models.WhiteboardElement{existing}, ops)

	require.Len(t, got, 2)
	assert.Equal(t, existing.ID, got[0].ID)
	assert.Equal(t, newID, got[1].ID)
	assert.Equal(t, "ellipse", got[1].ElementType)
	assert.Equal(t, 5, got[1].ZIndex)
	assert.Equal(t, wbID, got[1].WhiteboardID)
}

func TestMergePendingOperations_UpdateOverlay_AppliesNonNilFields(t *testing.T) {
	id := uuid.New()
	existing := makeDBElement(id, "rect", `{"id":"a","x":1}`, 0)
	ops := []whiteboardDB.PendingElementOperation{{
		ElementID: id,
		Operation: whiteboardDB.PendingElementUpdate,
		Props:     datatypes.JSON([]byte(`{"id":"a","x":99}`)),
		ZIndex:    intPtr(3),
		UpdatedAt: time.Now().UTC(),
	}}

	got := whiteboardSvc.MergePendingOperations([]models.WhiteboardElement{existing}, ops)

	require.Len(t, got, 1)
	assert.Equal(t, "rect", got[0].ElementType, "ElementType not overwritten when op leaves it empty")
	assert.JSONEq(t, `{"id":"a","x":99}`, string(got[0].Props))
	assert.Equal(t, 3, got[0].ZIndex)
}

func TestMergePendingOperations_UpdateZIndexZero_Applied(t *testing.T) {
	id := uuid.New()
	existing := makeDBElement(id, "rect", `{"id":"a"}`, 7)
	ops := []whiteboardDB.PendingElementOperation{{
		ElementID: id,
		Operation: whiteboardDB.PendingElementUpdate,
		ZIndex:    intPtr(0),
	}}

	got := whiteboardSvc.MergePendingOperations([]models.WhiteboardElement{existing}, ops)

	require.Len(t, got, 1)
	assert.Equal(t, 0, got[0].ZIndex, "ZIndex=0 must be applied, not treated as unset")
}

func TestMergePendingOperations_DeleteOverlay_RemovesElement(t *testing.T) {
	a := makeDBElement(uuid.New(), "rect", `{"id":"a"}`, 0)
	b := makeDBElement(uuid.New(), "rect", `{"id":"b"}`, 1)
	ops := []whiteboardDB.PendingElementOperation{{
		ElementID: a.ID,
		Operation: whiteboardDB.PendingElementDelete,
	}}

	got := whiteboardSvc.MergePendingOperations([]models.WhiteboardElement{a, b}, ops)

	require.Len(t, got, 1)
	assert.Equal(t, b.ID, got[0].ID)
}

func TestMergePendingOperations_Mixed_CreateUpdateDelete(t *testing.T) {
	a := makeDBElement(uuid.New(), "rect", `{"id":"a"}`, 0)
	b := makeDBElement(uuid.New(), "rect", `{"id":"b"}`, 1)
	c := makeDBElement(uuid.New(), "rect", `{"id":"c"}`, 2)
	dID := uuid.New()

	ops := []whiteboardDB.PendingElementOperation{
		{ElementID: b.ID, Operation: whiteboardDB.PendingElementUpdate, ZIndex: intPtr(10)},
		{ElementID: c.ID, Operation: whiteboardDB.PendingElementDelete},
		{ElementID: dID, Operation: whiteboardDB.PendingElementCreate, ElementType: "text", ZIndex: intPtr(5)},
	}

	got := whiteboardSvc.MergePendingOperations([]models.WhiteboardElement{a, b, c}, ops)

	ids := []uuid.UUID{got[0].ID, got[1].ID, got[2].ID}
	assert.Equal(t, []uuid.UUID{a.ID, dID, b.ID}, ids,
		"order by ZIndex: a(0), d(5), b(10); c deleted")
}

func TestMergePendingOperations_UpdateForUnknownElement_Skipped(t *testing.T) {
	a := makeDBElement(uuid.New(), "rect", `{"id":"a"}`, 0)
	ops := []whiteboardDB.PendingElementOperation{{
		ElementID: uuid.New(),
		Operation: whiteboardDB.PendingElementUpdate,
		ZIndex:    intPtr(99),
	}}

	got := whiteboardSvc.MergePendingOperations([]models.WhiteboardElement{a}, ops)

	require.Len(t, got, 1)
	assert.Equal(t, a.ID, got[0].ID)
}
