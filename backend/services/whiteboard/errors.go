package whiteboard

import "errors"

var (
	ErrWhiteboardNotFound		= errors.New("whiteboard not found")
	ErrElementNotFound		= errors.New("whiteboard element not found")
	ErrCreateWhiteboardFailed	= errors.New("failed to create whiteboard")
	ErrCreateElementFailed		= errors.New("failed to create whiteboard element")
	ErrUpdateElementFailed 		= errors.New("failed to update whiteboard element")
	ErrDeleteElementFailed		= errors.New("failed to delete whiteboard element")
	ErrCheckProjectMembership	= errors.New("failed to check project membership")
	ErrMarshalCursorPresence	= errors.New("marshal cursor presence")
	ErrStoreCursorPresence		= errors.New("store cursor presence")
	ErrDeleteCursorPresence		= errors.New("delete cursor presence")
	ErrLoadCursorPresence		= errors.New("load cursor presence")
	ErrDecodeCursorPresence		= errors.New("decode cursor presence")
	ErrMarshalCursorSnapshot	= errors.New("marshal cursor snapshot")
	ErrPublishCursorSnapshot	= errors.New("publish cursor snapshot")
	ErrListPendingOperations	= errors.New("list pending whiteboard operations")
	ErrFoldPendingOperation	= errors.New("fold pending whiteboard operation")
	ErrMarkPendingFlush	= errors.New("mark pending whiteboard flush")
)
