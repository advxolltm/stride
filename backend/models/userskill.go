package models

import (
	"github.com/google/uuid"
)

type UserSkill struct {
	ID             uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	UserID         uuid.UUID
	ProjectSkillID uuid.UUID

	User         User         `gorm:"foreignKey:UserID"`
	ProjectSkill ProjectSkill `gorm:"foreignKey:ProjectSkillID"`
}
