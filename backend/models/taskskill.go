package models

import (
	"github.com/google/uuid"
)

type TaskSkill struct {
	ID             uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	TaskID         uuid.UUID
	ProjectSkillID uuid.UUID

	Task         Task         `gorm:"foreignKey:TaskID"`
	ProjectSkill ProjectSkill `gorm:"foreignKey:ProjectSkillID"`
}
