package models

import (
	"time"

	"github.com/google/uuid"
)

type TaskAssignee struct {
	ID              uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	TaskID          uuid.UUID
	ProjectMemberID uuid.UUID
	AssignedAt      time.Time `gorm:"default:current_timestamp"`

	Task          Task          `gorm:"foreignKey:TaskID"`
	ProjectMember ProjectMember `gorm:"foreignKey:ProjectMemberID"`
}