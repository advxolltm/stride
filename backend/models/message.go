package models

import (
	"time"

	"github.com/google/uuid"
)

type Message struct {
	ID        uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	SenderID  *uuid.UUID
	ProjectID uuid.UUID
	Content   string
	IsEdited  bool
	IsDeleted bool
	CreatedAt time.Time  `gorm:"default:current_timestamp"`
	EditedAt  *time.Time `gorm:"default:NULL"`
	DeletedAt *time.Time `gorm:"default:NULL"`

	Sender  *User   `gorm:"foreignKey:SenderID"`
	Project Project `gorm:"foreignKey:ProjectID"`
}
