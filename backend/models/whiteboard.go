package models

import (
	"time"

	"github.com/google/uuid"
)

type Whiteboard struct {
	ID        uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID uuid.UUID `json:"projectId"`
	CreatedAt time.Time `gorm:"default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time `gorm:"default:current_timestamp" json:"updatedAt"`

	Project  Project             `gorm:"foreignKey:ProjectID" json:"-"`
	Elements []WhiteboardElement `gorm:"foreignKey:WhiteboardID" json:"-"`
}
