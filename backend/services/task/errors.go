package task

import "errors"

var (
	ErrTaskNotFound                = errors.New("task not found")
	ErrSkillNotInSameProjectAsTask = errors.New("the skill to be added to the task is not part of the same project")
	ErrSkillAlreadyAssignedToTask  = errors.New("the skill is already assigned to the task")
)
