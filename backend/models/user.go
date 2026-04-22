package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	Username     string
	Email        string
	PasswordHash string    `json:"-"`
	FullName     *string
	AvatarURL    *AvatarURLMap `gorm:"type:jsonb"`
	CreatedAt    time.Time     `gorm:"default:current_timestamp"`
	UpdatedAt    time.Time `gorm:"default:current_timestamp"`

	Projects           []Project           `gorm:"foreignKey:CreatedBy"`
	ProjectMemberships []ProjectMember     `gorm:"foreignKey:UserID"`
	Messages           []Message           `gorm:"foreignKey:SenderID"`
	CreatedTasks       []Task              `gorm:"foreignKey:CreatedBy"`
	WhiteboardElements []WhiteboardElement `gorm:"foreignKey:CreatedBy"`
}
