package project

import "errors"

var (
	ErrProjectNotFound         = errors.New("project not found")
	ErrDuplicateSlug           = errors.New("project slug is not unique")
	ErrProjectStoreFailed      = errors.New("project store operation failed")
	ErrStatusDoesNotExist      = errors.New("Status has to be active or archived")
	ErrNonExistentUser         = errors.New("user not found")
	ErrNonExistentMember       = errors.New("member not found")
	ErrUserAlreadyMember       = errors.New("user is already a member of the project")
	ErrNonExistentProjectSkill = errors.New("the project skill you are trying to delete does not exist")
	ErrProjectMemberNotFound = errors.New("User is not a member of the project")
)
