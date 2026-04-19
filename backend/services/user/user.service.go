package user

import (
	"backend/config"
	"backend/db/user"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"io"
	"net/mail"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

//TODO: Tests user.service.go

type AvatarInput struct {
	Filename string
	File     io.Reader
	Size     int64
}

type UpdateUserInput struct {
	Email    *string
	Password *string
	FullName *string
	Avatar   *AvatarInput
}

type (
	UserService interface {
		GetAllUsers(ctx context.Context) ([]models.User, error)
		GetUser(ctx context.Context, id uuid.UUID) (*models.User, error)
		CreateUser(ctx context.Context, username string, email string, password string) (*models.User, error)
		UpdateUser(ctx context.Context, id uuid.UUID, input UpdateUserInput) (*models.User, error)
		DeleteUser(ctx context.Context, id uuid.UUID) error
		GetByEmailAndPassword(ctx context.Context, email, password string) (uuid.UUID, error)
	}
	userService struct {
		userStore user.UserStore
		cfg       validationConfig
		mediaDir  string
	}
)

const maxAvatarSize = 2 << 20 // 2MB

var allowedAvatarTypes = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
}

func NewUserService(userStore user.UserStore) UserService {
	mediaDir := config.EnvStr("MEDIA_DIR", "media")
	return &userService{userStore, loadValidationConfig(), mediaDir}
}

type validationConfig struct {
	PasswordMinLength      int
	PasswordRequireNumber  bool
	PasswordRequireSpecial bool
	UsernameMinLength      int
	UsernameMaxLength      int
}

func loadValidationConfig() validationConfig {
	return validationConfig{
		PasswordMinLength:      config.EnvInt("PASSWORD_MIN_LENGTH", 8),
		PasswordRequireNumber:  config.EnvBool("PASSWORD_REQUIRE_NUM", true),
		PasswordRequireSpecial: config.EnvBool("PASSWORD_REQUIRE_SPECIAL_CHAR", true),
		UsernameMinLength:      config.EnvInt("USERNAME_MIN_LENGTH", 3),
		UsernameMaxLength:      config.EnvInt("USERNAME_MAX_LENGTH", 255),
	}
}

func (s userService) validatePassword(password string) error {
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

func (s userService) validateUsername(username string) error {
	if len(username) < s.cfg.UsernameMinLength || len(username) > s.cfg.UsernameMaxLength {
		return ErrInvalidUsername
	}
	return nil
}

func (s userService) validateEmail(email string) error {
	_, err := mail.ParseAddress(email)
	if err != nil {
		return ErrInvalidEmail
	}
	return nil
}

func (s userService) hashPassword(password string) ([]byte, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("error hashing password: %w", err)
	}
	return hash, nil
}

func (s userService) validateAndHashPassword(password string) ([]byte, error) {
	if err := s.validatePassword(password); err != nil {
		return nil, err
	}
	return s.hashPassword(password)
}

func (s userService) CheckPassword(hashedPassword string, plainPassword string) error {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(plainPassword))
	if err != nil {
		return ErrInvalidPassword
	}
	return nil
}

func (s userService) GetAllUsers(ctx context.Context) ([]models.User, error) {
	users, err := s.userStore.GetAllUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrUserStoreFailed, err)
	}
	return users, nil
}

func (s userService) GetUser(ctx context.Context, id uuid.UUID) (*models.User, error) {
	u, err := s.userStore.GetUser(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("%w: %w", ErrUserStoreFailed, err)
	}
	return u, nil
}

func (s userService) CreateUser(ctx context.Context, username string, email string, password string) (*models.User, error) {
	if err := s.validateUsername(username); err != nil {
		return nil, err
	}

	if err := s.validateEmail(email); err != nil {
		return nil, err
	}

	hash, errHash := s.validateAndHashPassword(password)
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

func (s userService) UpdateUser(ctx context.Context, id uuid.UUID, input UpdateUserInput) (*models.User, error) {
	fields := user.UpdateUserFields{
		Email:    input.Email,
		FullName: input.FullName,
	}

	if input.Email != nil {
		if err := s.validateEmail(*input.Email); err != nil {
			return nil, err
		}
	}

	if input.Password != nil {
		hash, err := s.validateAndHashPassword(*input.Password)
		if err != nil {
			return nil, err
		}
		hashStr := string(hash)
		fields.PasswordHash = &hashStr
	}

	if input.Avatar != nil {
		if err := validateAvatarFile(input.Avatar.Filename, input.Avatar.Size); err != nil {
			return nil, err
		}
		avatarURL, err := s.saveAvatarFile(id, input.Avatar.Filename, input.Avatar.File)
		if err != nil {
			return nil, err
		}
		fields.AvatarURL = &avatarURL
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

func (s userService) DeleteUser(ctx context.Context, id uuid.UUID) error {
	err := s.userStore.DeleteUser(ctx, id)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrUserStoreFailed, err)
	}
	return nil
}

func (s userService) GetByEmailAndPassword(ctx context.Context, email, password string) (uuid.UUID, error) {
	userId, err := s.userStore.GetByEmailAndPassword(ctx, email, password)
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: %w", ErrUserFindFailed, err)
	}

	if userId == uuid.Nil {
		return uuid.Nil, ErrUserNotFound
	}

	return userId, nil
}

func validateAvatarFile(filename string, size int64) error {
	if size > maxAvatarSize {
		return ErrAvatarTooLarge
	}
	ext := strings.ToLower(filepath.Ext(filename))
	if !allowedAvatarTypes[ext] {
		return ErrAvatarInvalidType
	}
	return nil
}

func (s userService) saveAvatarFile(userID uuid.UUID, filename string, file io.Reader) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	avatarsDir := filepath.Join(s.mediaDir, "avatars")
	if err := os.MkdirAll(avatarsDir, 0o755); err != nil {
		return "", fmt.Errorf("%w: %w", ErrAvatarSaveFailed, err)
	}

	storedName := userID.String() + ext
	dstPath := filepath.Join(avatarsDir, storedName)

	dst, err := os.Create(dstPath)
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrAvatarSaveFailed, err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("%w: %w", ErrAvatarSaveFailed, err)
	}

	return "/media/avatars/" + storedName, nil
}