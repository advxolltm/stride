package project

import "errors"

var (
    ErrProjectNotFound				= errors.New("project not found")
    ErrDuplicateSlug                = errors.New("project slug is not unique")
    ErrProjectStoreFailed			= errors.New("project store operation failed")
)