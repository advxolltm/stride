package models

import (
	"time"

	"github.com/google/uuid"
)

type ChatMemberCursor struct {
	ID                            uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	ProjectID                     uuid.UUID
	ProjectMemberID               uuid.UUID
	LastDeliveredMessageID        uuid.UUID
	LastDeliveredMessageCreatedAt time.Time
	DeliveredAt                   time.Time `gorm:"default:current_timestamp"`
	LastReadMessageID             *uuid.UUID
	LastReadMessageCreatedAt      *time.Time
	ReadAt                        *time.Time
	UpdatedAt                     time.Time `gorm:"default:current_timestamp"`

	Project       Project       `gorm:"foreignKey:ProjectID"`
	ProjectMember ProjectMember `gorm:"foreignKey:ProjectMemberID"`
}
