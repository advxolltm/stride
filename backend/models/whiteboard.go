package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Whiteboard struct {
	ID          uuid.UUID      `gorm:"primaryKey;default:gen_random_uuid()"`
	ProjectID   uuid.UUID
	CanvasState datatypes.JSON 
	CreatedAt   time.Time `gorm:"default:current_timestamp"`
	UpdatedAt   time.Time `gorm:"default:current_timestamp"`

	Project  Project             `gorm:"foreignKey:ProjectID"`
	Elements []WhiteboardElement `gorm:"foreignKey:WhiteboardID"`
}