package project

import "errors"

var (
    ErrProjectNotFound				= errors.New("project not found")
	ErrDuplicateSlug                = errors.New("project slug is not unique")
    ErrProjectStoreFailed			= errors.New("project store operation failed")
    ErrNonExistentUser              = errors.New("the user(s) you are trying to insert do not exist")
)