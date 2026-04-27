package models

import (
	"github.com/google/uuid"
)

type ProjectSkill struct {
	ID          uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	ProjectID   uuid.UUID
	Name        string
	Description *string

	Project Project `gorm:"foreignKey:ProjectID"`
}
