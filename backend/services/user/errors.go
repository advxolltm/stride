package user

import "errors"

var (
    ErrUserNotFound				= errors.New("user not found")
    ErrDuplicateEmail			= errors.New("email already in use")
    ErrDuplicateUsername		= errors.New("username already in use")
    ErrInvalidPassword			= errors.New("invalid password")
    ErrInvalidEmail				= errors.New("invalid email")
    ErrInvalidUsername			= errors.New("invalid username")
    ErrPasswordTooShort			= errors.New("password too short")
    ErrPasswordMissingSpecial	= errors.New("password must contain a special character")
    ErrPasswordHashFailed		= errors.New("failed to hash password")
    ErrUserStoreFailed			= errors.New("user store operation failed")
)