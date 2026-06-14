package models

import (
	"time"

	"github.com/google/uuid"
)

type ProjectMember struct {
	ID           uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	UserID       uuid.UUID
	ProjectID    uuid.UUID
	Role         string
	WorkingHours int
	JoinedAt     time.Time `gorm:"default:current_timestamp"`

	User          User           `gorm:"foreignKey:UserID"`
	Project       Project        `gorm:"foreignKey:ProjectID"`
	TaskAssignees []TaskAssignee `gorm:"foreignKey:ProjectMemberID"`
	Messages      []Message      `gorm:"foreignKey:SenderID"`
	Skills        []ProjectSkill `gorm:"many2many:member_skills;joinForeignKey:member_id;joinReferences:skill_id"`
}
