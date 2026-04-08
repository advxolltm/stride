package user

import (
	"backend/db/user"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UpdateUserInput struct {
	Email		*string
	Password 	*string
	FullName	*string
	AvatarURL	*string
}

type (
	UserService interface {
		GetUser(ctx context.Context, id uuid.UUID) (*models.User, error)
		CreateUser(ctx context.Context, username string, email string, password string) (*models.User, error)
		UpdateUser(ctx context.Context, id uuid.UUID, input UpdateUserInput) (*models.User, error)
		DeleteUser(ctx context.Context, id uuid.UUID) error
	}
	userServise struct {
		userStore	user.UserStore
		cfg			validationConfig
	}
)


func NewUserService(userStore user.UserStore) UserService {
	return &userServise{userStore, loadValidationConfig()}
}


type validationConfig struct {
	PasswordMinLength		int
	PasswordRequireNumber	bool
	PasswordRequireSpecial	bool
	UsernameMinLength		int
	UsernameMaxLength		int
}

func envInt(key string, fallback int) int {
	if val, ok := os.LookupEnv(key); ok {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return fallback
}

func loadValidationConfig() validationConfig {
	return validationConfig{
		PasswordMinLength:		envInt("PASSWORD_MIN_LENGTH", 8),
		PasswordRequireNumber:	os.Getenv("PASSWORD_REQUIRE_NUM") == "true",
		PasswordRequireSpecial:	os.Getenv("PASSWORD_REQUIRE_SPECIAL_CHAR") == "true",
		UsernameMinLength:		envInt("USERNAME_MIN_LENGTH", 3),
		UsernameMaxLength:		envInt("USERNAME_MAX_LENGTH", 255),
	}
}

func (s userServise) validatePassword(password string) error {
	if len(password) < s.cfg.PasswordMinLength {
		return ErrPasswordTooShort
	}
	if s.cfg.PasswordRequireSpecial {
		if !strings.ContainsAny(password, "!@#$%^&*") {
			return ErrPasswordMissingSpecial
		}
	}
	return nil
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func (s userServise) validateUsername(username string) error {
	if len(username) < s.cfg.UsernameMinLength || len(username) > s.cfg.UsernameMaxLength {
		return ErrInvalidUsername
	}
	return nil
}

func (s userServise) validateEmail(email string) error {
	if !emailRegex.MatchString(email) {
		return ErrInvalidEmail
	}
	return nil
}

func (s userServise) hashPassword(password string) ([]byte, error) {
	if err := s.validatePassword(password); err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("error hashing password: %w", err)
	}
	return hash, nil
}

func (s userServise) CheckPassword(hashedPassword string, plainPassword string) error {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(plainPassword))
	if err != nil {
		return ErrInvalidPassword
	}
	return nil
}

func (s userServise) GetUser(ctx context.Context, id uuid.UUID) (*models.User, error) {
	u, err := s.userStore.GetUser(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("%w: %w", ErrUserStoreFailed, err)
	}
	return u, nil
}

func (s userServise) CreateUser(ctx context.Context, username string, email string, password string) (*models.User, error) {
	if err := s.validateUsername(username); err != nil {
		return nil, err
	}

	if err := s.validateEmail(email); err != nil {
		return nil, err
	}


	hash, errHash := s.hashPassword(password)
	if errHash != nil {
		return nil, errHash
	}




	u := &models.User{
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
	}
	err := s.userStore.CreateUser(ctx, u)
	if err != nil {
		if errors.Is(err, user.ErrDuplicateEmail) {
			return nil, ErrDuplicateEmail
		}
		if errors.Is(err, user.ErrDuplicateUsername) {
			return nil, ErrDuplicateUsername
		}
		return nil, fmt.Errorf("%w: %w", ErrUserStoreFailed, err)
	}
	return u, nil
}


func (s userServise) UpdateUser(ctx context.Context, id uuid.UUID, input UpdateUserInput) (*models.User, error) {
	fields := user.UpdateUserFields{
		Email:     input.Email,
		FullName:  input.FullName,
		AvatarURL: input.AvatarURL,
	}

	if input.Email != nil {
		if err := s.validateEmail(*input.Email); err != nil {
			return nil, err
		}
	}

	if input.Password != nil {
		hash, err := s.hashPassword(*input.Password)
		if err != nil {
			return nil, err
		}
		hashStr := string(hash)
		fields.PasswordHash = &hashStr
	}

	u, err := s.userStore.UpdateUser(ctx, id, fields)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		if errors.Is(err, user.ErrDuplicateEmail) {
			return nil, ErrDuplicateEmail
		}
		return nil, fmt.Errorf("%w: %w", ErrUserStoreFailed, err)
	}
	return u, nil
}

func (s userServise) DeleteUser(ctx context.Context, id uuid.UUID) error {
	err := s.userStore.DeleteUser(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("%w: %w", ErrUserStoreFailed, err)
	}
	return nil
}