package models

import (
	"time"

	"github.com/google/uuid"
)

type ProjectMember struct {
	ID        uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	UserID    uuid.UUID
	ProjectID uuid.UUID
	Role      string
	JoinedAt  time.Time `gorm:"default:current_timestamp"`

	User          User           `gorm:"foreignKey:UserID"`
	Project       Project        `gorm:"foreignKey:ProjectID"`
	TaskAssignees []TaskAssignee `gorm:"foreignKey:ProjectMemberID"`
}