package models

import (
	"time"

	"github.com/google/uuid"
)

type Task struct {
	ID                      uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	ProjectID               uuid.UUID
	CreatedBy               uuid.UUID
	Title                   string
	Description             *string
	Status                  string
	StartDate               *time.Time
	DueDate                 *time.Time
	ExpectedDurationMinutes *int
	Position                int
	CreatedAt               time.Time  `gorm:"default:current_timestamp"`
	UpdatedAt               time.Time  `gorm:"default:current_timestamp"`
	CompletedAt             *time.Time `gorm:"default:NULL"`

	Project   Project        `gorm:"foreignKey:ProjectID"`
	Creator   ProjectMember  `gorm:"foreignKey:CreatedBy"`
	Assignees []TaskAssignee `gorm:"foreignKey:TaskID"`
}

