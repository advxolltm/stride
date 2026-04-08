package user

import (
	"backend/models"
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TODO: Tests user.db.go

type UpdateUserFields struct {
    Email			*string	`gorm:"column:email"`
    PasswordHash	*string	`gorm:"column:password_hash"`
    FullName		*string	`gorm:"column:full_name"`
    AvatarURL		*string	`gorm:"column:avatar_url"`
}

type (
	UserStore interface {
		GetAllUsers(ctx context.Context) ([]models.User, error)
		GetUser(ctx context.Context, id uuid.UUID) (*models.User, error)
		CreateUser(ctx context.Context, user *models.User) error
		UpdateUser(ctx context.Context, id uuid.UUID, fields UpdateUserFields) (*models.User, error)
		DeleteUser(ctx context.Context, id uuid.UUID) error
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
		if errors.As(result.Error, &pgErr) && pgErr.Code == "23505" {
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
	var user models.User
	result := s.db.WithContext(ctx).Model(&user).
		Clauses(clause.Returning{}).
		Where("id = ?", id).
		Updates(fields)
	if result.Error != nil {
		var pgErr *pgconn.PgError
		if errors.As(result.Error, &pgErr) && pgErr.Code == "23505" {
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

