package project

import "errors"

var (
	ErrProjectNotFound         = errors.New("project not found")
	ErrDuplicateSlug           = errors.New("project slug is not unique")
	ErrProjectStoreFailed      = errors.New("project store operation failed")
	ErrNonExistentUser         = errors.New("the user(s) you are trying to insert do not exist")
	ErrNonExistentMember       = errors.New("the members you are trying to modify do not exist")
	ErrUserAlreadyMember       = errors.New("one or more users are already members of the project")
	ErrNonExistentProjectSkill = errors.New("the project skill you are trying to delete does not exist")
	ErrNonExistentProjectTask  = errors.New("task not found")
)
