package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type WhiteboardElement struct {
	ID           uuid.UUID      `gorm:"primaryKey;default:gen_random_uuid()"`
	WhiteboardID uuid.UUID
	CreatedBy    *uuid.UUID
	ElementType  string
	Props        datatypes.JSON
	ZIndex       int
	CreatedAt    time.Time `gorm:"default:current_timestamp"`
	UpdatedAt    time.Time `gorm:"default:current_timestamp"`

	Whiteboard Whiteboard `gorm:"foreignKey:WhiteboardID"`
	Creator    *User      `gorm:"foreignKey:CreatedBy"`
}