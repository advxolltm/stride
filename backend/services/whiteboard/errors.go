package whiteboard

import "errors"

var (
	ErrWhiteboardNotFound     = errors.New("whiteboard not found")
	ErrElementNotFound        = errors.New("whiteboard element not found")
	ErrCreateWhiteboardFailed = errors.New("failed to create whiteboard")
	ErrCreateElementFailed    = errors.New("failed to create whiteboard element")
	ErrUpdateElementFailed    = errors.New("failed to update whiteboard element")
	ErrDeleteElementFailed    = errors.New("failed to delete whiteboard element")
)
