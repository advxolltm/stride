package user

import (
	"backend/db"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TODO: Tests user.db.go

type UpdateUserFields struct {
	Email        *string              `gorm:"column:email"`
	PasswordHash *string              `gorm:"column:password_hash"`
	FullName     *string              `gorm:"column:full_name"`
	AvatarURL    *models.AvatarURLMap `gorm:"column:avatar_url;type:jsonb"`
	SetAvatarURL bool                 `gorm:"-"`
}

type SetAllWorkingHoursRequest struct {
	ProjectID    uuid.UUID
	WorkingHours int
}

type (
	UserStore interface {
		GetAllUsers(ctx context.Context) ([]models.User, error)
		GetUser(ctx context.Context, id uuid.UUID) (*models.User, error)
		CreateUser(ctx context.Context, user *models.User) error
		UpdateUser(ctx context.Context, id uuid.UUID, fields UpdateUserFields) (*models.User, error)
		DeleteUser(ctx context.Context, id uuid.UUID) error
		GetByEmailAndPassword(ctx context.Context, email, passwordHash string) (uuid.UUID, error)
		SetWorkingHours(ctx context.Context, projID uuid.UUID, workingHors int, userID uuid.UUID) (*models.ProjectMember, error)
		AddSkill(ctx context.Context, projID uuid.UUID, skillID uuid.UUID, userID uuid.UUID) (*models.ProjectMember, error)
		RemoveSkill(ctx context.Context, projID uuid.UUID, skillID uuid.UUID, userID uuid.UUID) (*models.ProjectMember, error)
		SetAllWorkingHours(ctx context.Context, settings []SetAllWorkingHoursRequest, userID uuid.UUID) error
		GetUserSkills(ctx context.Context, userID uuid.UUID, projectID uuid.UUID) ([]models.ProjectSkill, error)
		UpdateUserProjectSkills(ctx context.Context, userID uuid.UUID, projectID uuid.UUID, skillIDs []uuid.UUID) ([]models.ProjectSkill, error)
	}

	userStore struct {
		db *gorm.DB
	}
)

func NewUserStore(db *gorm.DB) UserStore {
	return &userStore{db}
}

func (s *userStore) GetAllUsers(ctx context.Context) ([]models.User, error) {
	var users []models.User
	result := s.db.WithContext(ctx).Find(&users)
	if result.Error != nil {
		return nil, result.Error
	}
	return users, nil
}

func (s *userStore) GetUser(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	result := s.db.WithContext(ctx).First(&user, "id = ?", id)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func (s *userStore) CreateUser(ctx context.Context, user *models.User) error {
	result := s.db.WithContext(ctx).Create(user)
	if result.Error != nil {
		var pgErr *pgconn.PgError
		if errors.As(result.Error, &pgErr) && pgErr.Code == db.UniqueConstraintViolationCode {
			if strings.Contains(pgErr.ConstraintName, "email") {
				return ErrDuplicateEmail
			}
			return ErrDuplicateUsername
		}
		return result.Error
	}
	return nil
}

func (s *userStore) UpdateUser(ctx context.Context, id uuid.UUID, fields UpdateUserFields) (*models.User, error) {
	updates := map[string]any{}
	if fields.Email != nil {
		updates["email"] = *fields.Email
	}
	if fields.PasswordHash != nil {
		updates["password_hash"] = *fields.PasswordHash
	}
	if fields.FullName != nil {
		updates["full_name"] = *fields.FullName
	}
	if fields.SetAvatarURL || fields.AvatarURL != nil {
		updates["avatar_url"] = fields.AvatarURL
	}

	var user models.User
	if len(updates) == 0 {
		return s.GetUser(ctx, id)
	}

	result := s.db.WithContext(ctx).Model(&user).
		Clauses(clause.Returning{}).
		Where("id = ?", id).
		Updates(updates)
	if result.Error != nil {
		var pgErr *pgconn.PgError
		if errors.As(result.Error, &pgErr) && pgErr.Code == db.UniqueConstraintViolationCode {
			if strings.Contains(pgErr.ConstraintName, "email") {
				return nil, ErrDuplicateEmail
			}
		}
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &user, nil
}

func (s *userStore) DeleteUser(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).Delete(&models.User{}, "id = ?", id)
	if result.Error != nil {
		return gorm.ErrRecordNotFound
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *userStore) GetByEmailAndPassword(ctx context.Context, email, password string) (uuid.UUID, error) {
	var user models.User

	result := s.db.WithContext(ctx).
		First(&user, "email = ?", email)

	if result.Error != nil {
		// not found is not an error-case
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return uuid.Nil, nil
		}

		return uuid.Nil, result.Error
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return uuid.Nil, err
	}

	return user.ID, nil
}

func (s *userStore) GetUserSkills(ctx context.Context, userID uuid.UUID, projID uuid.UUID) ([]models.ProjectSkill, error) {

	var member models.ProjectMember
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND project_id = ?", userID, projID).
		First(&member).Error

	if err != nil {
		return nil, fmt.Errorf("failed to find project member: %w", err)
	}

	var userSkills []models.ProjectSkill
	err = s.db.WithContext(ctx).Model(&member).Association("Skills").Find(&userSkills)

	if err != nil {
		return nil, fmt.Errorf("failed to find user skills: %w", err)
	}
	return userSkills, nil
}

func (s *userStore) UpdateUserProjectSkills(ctx context.Context, userID uuid.UUID, projectID uuid.UUID, skillIDs []uuid.UUID) ([]models.ProjectSkill, error) {
	var member models.ProjectMember
	err_mem := s.db.WithContext(ctx).
		Where("user_id = ? AND project_id = ?", userID, projectID).
		First(&member).Error

	if err_mem != nil {
		return nil, ErrUserNotProjectMember
	}
	uniqueSkillIDs := make([]uuid.UUID, 0, len(skillIDs))
	seenSkillIDs := map[uuid.UUID]struct{}{}
	for _, skillID := range skillIDs {
		if _, exists := seenSkillIDs[skillID]; exists {
			continue
		}
		seenSkillIDs[skillID] = struct{}{}
		uniqueSkillIDs = append(uniqueSkillIDs, skillID)
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var memberCount int64
		if err := tx.Model(&models.ProjectMember{}).
			Where("user_id = ? AND project_id = ?", userID, projectID).
			Count(&memberCount).Error; err != nil {
			return err
		}
		if memberCount == 0 {
			var projectCount int64
			if err := tx.Model(&models.Project{}).
				Where("id = ?", projectID).
				Count(&projectCount).Error; err != nil {
				return err
			}
			if projectCount == 0 {
				return ErrProjectNotFound
			}
			return ErrUserNotProjectMember
		}

		if len(uniqueSkillIDs) == 0 {
			return tx.Model(&member).Association("Skills").Clear()
		}

		newSkills := make([]models.ProjectSkill, len(uniqueSkillIDs))
		for i, skillID := range uniqueSkillIDs {
			newSkills[i] = models.ProjectSkill{ID: skillID}
		}

		return tx.Model(&member).Association("Skills").Replace(&newSkills)
	})
	if err != nil {
		return nil, err
	}

	return s.GetUserSkills(ctx, userID, projectID)
}

func (s *userStore) SetWorkingHours(ctx context.Context, projID uuid.UUID, workingHors int, userID uuid.UUID) (*models.ProjectMember, error) {
	member := models.ProjectMember{UserID: userID, ProjectID: projID}
	result := s.db.WithContext(ctx).Preload("User").Model(&member).Where("user_id = ? AND project_id = ?", userID, projID).Update("working_hours", workingHors)

	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &member, nil
}

func (s *userStore) SetAllWorkingHours(ctx context.Context, settings []SetAllWorkingHoursRequest, userID uuid.UUID) error {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, setting := range settings {
			member := models.ProjectMember{UserID: userID, ProjectID: setting.ProjectID}
			result := s.db.WithContext(ctx).Preload("User").Model(&member).Where("user_id = ? AND project_id = ?", userID, setting.ProjectID).Update("working_hours", setting.WorkingHours)

			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return gorm.ErrRecordNotFound
			}
		}
		return nil
	})

	if err != nil {
		return err
	}
	return nil
}

func (s *userStore) AddSkill(ctx context.Context, projID uuid.UUID, skillID uuid.UUID, userID uuid.UUID) (*models.ProjectMember, error) {
	var member models.ProjectMember
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND project_id = ?", userID, projID).
		First(&member).Error

	if err != nil {
		return nil, fmt.Errorf("failed to find project member: %w", err)
	}

	skill := models.ProjectSkill{ID: skillID}
	err = s.db.WithContext(ctx).Model(&member).Association("Skills").Append(&skill)

	if err != nil {
		return nil, fmt.Errorf("failed to add skill to project member: %w", err)
	}

	result := s.db.WithContext(ctx).Preload("User").First(&member, member.ID)

	if result.Error != nil {
		return nil, result.Error
	}
	return &member, nil
}

func (s *userStore) RemoveSkill(ctx context.Context, projID uuid.UUID, skillID uuid.UUID, userID uuid.UUID) (*models.ProjectMember, error) {
	var member models.ProjectMember
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND project_id = ?", userID, projID).
		First(&member).Error

	if err != nil {
		return nil, fmt.Errorf("failed to find project member: %w", err)
	}

	skill := models.ProjectSkill{ID: skillID}
	err = s.db.WithContext(ctx).Model(&member).Association("Skills").Delete(&skill)

	if err != nil {
		return nil, fmt.Errorf("failed to add skill to project member: %w", err)
	}

	result := s.db.WithContext(ctx).Preload("User").First(&member, member.ID)

	if result.Error != nil {
		return nil, result.Error
	}
	return &member, nil
}
