package notification

import "errors"

var (
	ErrNotificationNotFound         = errors.New("notification not found")
	ErrNotificationStoreUnavailable = errors.New("notification store is unavailable")
	ErrNotificationIDRequired       = errors.New("notification id is required")
	ErrNotificationUserIDRequired   = errors.New("notification user id is required")
	ErrNotificationObjectTypeRequired = errors.New("notification object type is required")
	ErrNotificationObjectIDRequired = errors.New("notification object id is required")
	ErrNotificationMessageRequired  = errors.New("notification message is required")
)
