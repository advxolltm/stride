package task

import "errors"

var (
	ErrDuplicateTaskAssignment    = errors.New("duplicate task assignment")
	ErrTaskPositionOutOfBounds    = errors.New("task position out of bounds")
	ErrSkillAlreadyAssignedToTask = errors.New("the skill is already assigned to the task")
)
