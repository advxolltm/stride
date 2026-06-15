package whiteboard

import "time"

type CursorUser struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AvatarSmall string `json:"avatarSmall"`
}

type CursorPosition struct {
	X *float64 `json:"x"`
	Y *float64 `json:"y"`
}

type CursorPresence struct {
	User   CursorUser     `json:"user"`
	Cursor CursorPosition `json:"cursor"`
}

type CursorPresenceRecord struct {
	ConnectionID string         `json:"connectionId"`
	User         CursorUser     `json:"user"`
	Cursor       CursorPosition `json:"cursor"`
	UpdatedAt    time.Time      `json:"updatedAt"`
}

type CursorClientMessage struct {
	Cursor CursorPosition `json:"cursor"`
}
