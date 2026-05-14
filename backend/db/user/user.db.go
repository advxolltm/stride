package user

import (
	"backend/db"
	"backend/models"
	"context"
	"errors"
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

type (
	UserStore interface {
		GetAllUsers(ctx context.Context) ([]models.User, error)
		GetUser(ctx context.Context, id uuid.UUID) (*models.User, error)
		CreateUser(ctx context.Context, user *models.User) error
		UpdateUser(ctx context.Context, id uuid.UUID, fields UpdateUserFields) (*models.User, error)
		DeleteUser(ctx context.Context, id uuid.UUID) error
		GetByEmailAndPassword(ctx context.Context, email, passwordHash string) (uuid.UUID, error)
		GetUserSkills(ctx context.Context, userID uuid.UUID) ([]models.UserSkill, error)
		UpdateUserProjectSkills(ctx context.Context, userID uuid.UUID, projectID uuid.UUID, skillIDs []uuid.UUID) ([]models.UserSkill, error)
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

func (s *userStore) GetUserSkills(ctx context.Context, userID uuid.UUID) ([]models.UserSkill, error) {
	var userSkills []models.UserSkill
	result := s.db.WithContext(ctx).
		Preload("ProjectSkill").
		Joins("JOIN project_skills ON project_skills.id = user_skills.project_skill_id").
		Where("user_skills.user_id = ?", userID).
		Order("project_skills.project_id ASC, project_skills.name ASC").
		Find(&userSkills)
	if result.Error != nil {
		return nil, result.Error
	}
	return userSkills, nil
}

func (s *userStore) UpdateUserProjectSkills(ctx context.Context, userID uuid.UUID, projectID uuid.UUID, skillIDs []uuid.UUID) ([]models.UserSkill, error) {
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

		if len(uniqueSkillIDs) > 0 {
			var matchingSkillCount int64
			if err := tx.Model(&models.ProjectSkill{}).
				Where("project_id = ? AND id IN ?", projectID, uniqueSkillIDs).
				Count(&matchingSkillCount).Error; err != nil {
				return err
			}
			if matchingSkillCount != int64(len(uniqueSkillIDs)) {
				return ErrProjectSkillNotFound
			}
		}

		if err := tx.
			Where("user_id = ? AND project_skill_id IN (?)",
				userID,
				tx.Model(&models.ProjectSkill{}).Select("id").Where("project_id = ?", projectID),
			).
			Delete(&models.UserSkill{}).Error; err != nil {
			return err
		}

		if len(uniqueSkillIDs) == 0 {
			return nil
		}

		userSkills := make([]models.UserSkill, len(uniqueSkillIDs))
		for i, skillID := range uniqueSkillIDs {
			userSkills[i] = models.UserSkill{
				UserID:         userID,
				ProjectSkillID: skillID,
			}
		}

		return tx.Create(&userSkills).Error
	})
	if err != nil {
		return nil, err
	}

	return s.GetUserSkills(ctx, userID)
}
