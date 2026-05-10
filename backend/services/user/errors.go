package user

import "errors"

var (
	ErrUserNotFound           = errors.New("user not found")
	ErrDuplicateEmail         = errors.New("email already in use")
	ErrDuplicateUsername      = errors.New("username already in use")
	ErrInvalidPassword        = errors.New("invalid password")
	ErrInvalidEmail           = errors.New("invalid email")
	ErrInvalidUsername        = errors.New("invalid username")
	ErrPasswordTooShort       = errors.New("password too short")
	ErrPasswordMissingSpecial = errors.New("password must contain a special character")
	ErrPasswordUnchanged      = errors.New("new password must be different from current password")
	ErrPasswordHashFailed     = errors.New("failed to hash password")
	ErrUserStoreFailed        = errors.New("user store operation failed")
	ErrUserFindFailed         = errors.New("failed to check if user exists")
	ErrAvatarTooLarge         = errors.New("avatar file too large (max 2MB)")
	ErrAvatarInvalidType      = errors.New("avatar must be an image (jpeg, png, gif, webp)")
	ErrAvatarSaveFailed       = errors.New("failed to save avatar file")
	ErrAvatarDeleteFailed     = errors.New("failed to delete avatar files")
	ErrAvatarCorruptImage     = errors.New("uploaded file is not a valid image")
	ErrAvatarProcessingFailed = errors.New("failed to process avatar thumbnails")
)
