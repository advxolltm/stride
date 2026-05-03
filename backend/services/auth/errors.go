package auth

import "errors"

var (
	ErrUnauthorized       = errors.New("unauthorized")
	ErrInvalidCredentials = errors.New("email or password incorrect")
	ErrUserIDNotInContext = errors.New("userID not found in context")
	ErrAccessDenied       = errors.New("user does not have access to this project")
)
