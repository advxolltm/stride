package models

import (
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID           uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	CreatedBy   *uuid.UUID
	Name        string
	Slug        string
	Description *string
	Status      string
	CreatedAt   time.Time `gorm:"default:current_timestamp"`
	UpdatedAt   time.Time `gorm:"default:current_timestamp"`
	JoinLink    *uuid.UUID

	Creator     *User           `gorm:"foreignKey:CreatedBy"`
	Members     []ProjectMember `gorm:"foreignKey:ProjectID"`
	Skills      []ProjectSkill  `gorm:"foreignKey:ProjectID"`
	Messages    []Message       `gorm:"foreignKey:ProjectID"`
	Tasks       []Task          `gorm:"foreignKey:ProjectID"`
	Whiteboards []Whiteboard    `gorm:"foreignKey:ProjectID"`
}