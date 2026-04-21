package task

import "errors"

var (
	ErrDuplicateTaskAssignment = errors.New("duplicate task assignment")
	ErrTaskPositionOutOfBounds = errors.New("task position out of bounds")
)
