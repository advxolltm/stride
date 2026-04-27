package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type WhiteboardElement struct {
	ID           uuid.UUID      `gorm:"primaryKey;default:gen_random_uuid()" json:"id"`
	WhiteboardID uuid.UUID      `json:"whiteboardId"`
	CreatedBy    *uuid.UUID     `json:"createdBy"`
	ElementType  string         `json:"elementType"`
	Props        datatypes.JSON `json:"props"`
	ZIndex       int            `json:"zIndex"`
	CreatedAt    time.Time      `gorm:"default:current_timestamp" json:"createdAt"`
	UpdatedAt    time.Time      `gorm:"default:current_timestamp" json:"updatedAt"`

	Whiteboard Whiteboard `gorm:"foreignKey:WhiteboardID" json:"-"`
	Creator    *User      `gorm:"foreignKey:CreatedBy" json:"-"`
}
