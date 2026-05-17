package user

import "errors"

var (
	ErrDuplicateEmail       = errors.New("duplicate email")
	ErrDuplicateUsername    = errors.New("duplicate username")
	ErrProjectNotFound      = errors.New("project not found")
	ErrProjectSkillNotFound = errors.New("project skill not found")
	ErrUserNotProjectMember = errors.New("user is not a project member")
)
