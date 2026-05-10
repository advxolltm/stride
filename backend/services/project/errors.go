package project

import "errors"

var (
	ErrProjectNotFound         = errors.New("project not found")
	ErrDuplicateSlug           = errors.New("project slug is not unique")
	ErrProjectStoreFailed      = errors.New("project store operation failed")
	ErrStatusDoesNotExist      = errors.New("status has to be active or archived")
	ErrNonExistentUser         = errors.New("user not found")
	ErrNonExistentMember       = errors.New("member not found")
	ErrUserAlreadyMember       = errors.New("user is already a member of the project")
	ErrNonExistentProjectSkill = errors.New("project skill not found")
	ErrProjectMemberNotFound   = errors.New("user is not a member of the project")
	ErrNonExistentProjectTask  = errors.New("task not found")
	ErrProjectNameTooLong      = errors.New("project name cannot be longer than 255 characters")
	ErrSkillNameTooLong        = errors.New("skill name cannot be longer than 255 characters")
	ErrSkillDescriptionTooLong = errors.New("skill description cannot be longer than 255 characters")
)
