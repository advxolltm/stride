package user

import (
	userStore "backend/db/user"
	"backend/models"
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type stubUserStore struct {
	getAllUsersFn           func(ctx context.Context) ([]models.User, error)
	getUserFn               func(ctx context.Context, id uuid.UUID) (*models.User, error)
	createUserFn            func(ctx context.Context, user *models.User) error
	updateUserFn            func(ctx context.Context, id uuid.UUID, fields userStore.UpdateUserFields) (*models.User, error)
	deleteUserFn            func(ctx context.Context, id uuid.UUID) error
	getByEmailAndPasswordFn func(ctx context.Context, email, password string) (uuid.UUID, error)
}

func (s *stubUserStore) GetAllUsers(ctx context.Context) ([]models.User, error) {
	if s.getAllUsersFn == nil {
		panic("unexpected GetAllUsers call")
	}
	return s.getAllUsersFn(ctx)
}

func (s *stubUserStore) GetUser(ctx context.Context, id uuid.UUID) (*models.User, error) {
	if s.getUserFn == nil {
		panic("unexpected GetUser call")
	}
	return s.getUserFn(ctx, id)
}

func (s *stubUserStore) CreateUser(ctx context.Context, user *models.User) error {
	if s.createUserFn == nil {
		panic("unexpected CreateUser call")
	}
	return s.createUserFn(ctx, user)
}

func (s *stubUserStore) UpdateUser(ctx context.Context, id uuid.UUID, fields userStore.UpdateUserFields) (*models.User, error) {
	if s.updateUserFn == nil {
		panic("unexpected UpdateUser call")
	}
	return s.updateUserFn(ctx, id, fields)
}

func (s *stubUserStore) DeleteUser(ctx context.Context, id uuid.UUID) error {
	if s.deleteUserFn == nil {
		panic("unexpected DeleteUser call")
	}
	return s.deleteUserFn(ctx, id)
}

func (s *stubUserStore) GetByEmailAndPassword(ctx context.Context, email, password string) (uuid.UUID, error) {
	if s.getByEmailAndPasswordFn == nil {
		panic("unexpected GetByEmailAndPassword call")
	}
	return s.getByEmailAndPasswordFn(ctx, email, password)
}

func newTestService(t *testing.T, store *stubUserStore) userService {
	t.Helper()
	return userService{
		userStore: store,
		cfg: validationConfig{
			PasswordMinLength:      8,
			PasswordRequireNumber:  true,
			PasswordRequireSpecial: true,
			UsernameMinLength:      3,
			UsernameMaxLength:      255,
		},
		mediaDir: t.TempDir(),
	}
}

func runServiceTest(t *testing.T, name string, f func(*testing.T, userService, *stubUserStore)) {
	t.Helper()
	t.Run(name, func(t *testing.T) {
		store := &stubUserStore{}
		service := newTestService(t, store)
		f(t, service, store)
	})
}

func stringPtr(value string) *string {
	return &value
}

func mustHashPassword(t *testing.T, password string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	require.NoError(t, err)
	return string(hash)
}

type failingReader struct{}

func (failingReader) Read(_ []byte) (int, error) {
	return 0, errors.New("read failed")
}

func TestUserService_CreateUser(t *testing.T) {
	runServiceTest(t, "returns ErrInvalidUsername and does not call store for short username", func(t *testing.T, service userService, _ *stubUserStore) {
		created, err := service.CreateUser(context.Background(), "ab", "valid@test.com", "Valid!123")

		assert.Nil(t, created)
		assert.ErrorIs(t, err, ErrInvalidUsername)
	})

	runServiceTest(t, "returns ErrInvalidEmail and does not call store for malformed email", func(t *testing.T, service userService, _ *stubUserStore) {
		created, err := service.CreateUser(context.Background(), "valid-user", "not-an-email", "Valid!123")

		assert.Nil(t, created)
		assert.ErrorIs(t, err, ErrInvalidEmail)
	})

	runServiceTest(t, "returns ErrPasswordMissingSpecial and does not call store for password without special char", func(t *testing.T, service userService, _ *stubUserStore) {
		created, err := service.CreateUser(context.Background(), "valid-user", "valid@test.com", "Valid1234")

		assert.Nil(t, created)
		assert.ErrorIs(t, err, ErrPasswordMissingSpecial)
	})

	runServiceTest(t, "hashes password before persisting user", func(t *testing.T, service userService, store *stubUserStore) {
		ctx := context.Background()
		createdID := uuid.New()
		plainPassword := "Valid!123"
		var persisted *models.User

		store.createUserFn = func(_ context.Context, user *models.User) error {
			persisted = &models.User{
				Username:     user.Username,
				Email:        user.Email,
				PasswordHash: user.PasswordHash,
			}
			user.ID = createdID
			return nil
		}

		created, err := service.CreateUser(ctx, "valid-user", "valid@test.com", plainPassword)

		require.NoError(t, err)
		require.NotNil(t, created)
		require.NotNil(t, persisted)
		assert.Equal(t, createdID, created.ID)
		assert.Equal(t, "valid-user", persisted.Username)
		assert.Equal(t, "valid@test.com", persisted.Email)
		assert.NotEqual(t, plainPassword, persisted.PasswordHash)
		assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(persisted.PasswordHash), []byte(plainPassword)))
	})

	runServiceTest(t, "maps duplicate email from store", func(t *testing.T, service userService, store *stubUserStore) {
		store.createUserFn = func(_ context.Context, _ *models.User) error {
			return userStore.ErrDuplicateEmail
		}

		created, err := service.CreateUser(context.Background(), "valid-user", "valid@test.com", "Valid!123")

		assert.Nil(t, created)
		assert.ErrorIs(t, err, ErrDuplicateEmail)
	})

	runServiceTest(t, "maps duplicate username from store", func(t *testing.T, service userService, store *stubUserStore) {
		store.createUserFn = func(_ context.Context, _ *models.User) error {
			return userStore.ErrDuplicateUsername
		}

		created, err := service.CreateUser(context.Background(), "valid-user", "valid@test.com", "Valid!123")

		assert.Nil(t, created)
		assert.ErrorIs(t, err, ErrDuplicateUsername)
	})

	runServiceTest(t, "wraps unexpected store errors", func(t *testing.T, service userService, store *stubUserStore) {
		store.createUserFn = func(_ context.Context, _ *models.User) error {
			return errors.New("create failed")
		}

		created, err := service.CreateUser(context.Background(), "valid-user", "valid@test.com", "Valid!123")

		assert.Nil(t, created)
		assert.ErrorIs(t, err, ErrUserStoreFailed)
		assert.ErrorContains(t, err, "create failed")
	})
}

func TestUserService_GetAllUsers(t *testing.T) {
	runServiceTest(t, "wraps store errors", func(t *testing.T, service userService, store *stubUserStore) {
		store.getAllUsersFn = func(_ context.Context) ([]models.User, error) {
			return nil, errors.New("list failed")
		}

		users, err := service.GetAllUsers(context.Background())

		assert.Nil(t, users)
		assert.ErrorIs(t, err, ErrUserStoreFailed)
		assert.ErrorContains(t, err, "list failed")
	})
}

func TestUserService_GetUser(t *testing.T) {
	runServiceTest(t, "maps gorm ErrRecordNotFound to ErrUserNotFound", func(t *testing.T, service userService, store *stubUserStore) {
		store.getUserFn = func(_ context.Context, _ uuid.UUID) (*models.User, error) {
			return nil, gorm.ErrRecordNotFound
		}

		user, err := service.GetUser(context.Background(), uuid.New())

		assert.Nil(t, user)
		assert.ErrorIs(t, err, ErrUserNotFound)
	})

	runServiceTest(t, "wraps unexpected store errors", func(t *testing.T, service userService, store *stubUserStore) {
		store.getUserFn = func(_ context.Context, _ uuid.UUID) (*models.User, error) {
			return nil, errors.New("lookup failed")
		}

		user, err := service.GetUser(context.Background(), uuid.New())

		assert.Nil(t, user)
		assert.ErrorIs(t, err, ErrUserStoreFailed)
		assert.ErrorContains(t, err, "lookup failed")
	})
}

func TestUserService_UpdateUser(t *testing.T) {
	runServiceTest(t, "returns ErrInvalidEmail and does not call store for malformed email", func(t *testing.T, service userService, _ *stubUserStore) {
		updated, err := service.UpdateUser(context.Background(), uuid.New(), UpdateUserInput{Email: stringPtr("not-an-email")})

		assert.Nil(t, updated)
		assert.ErrorIs(t, err, ErrInvalidEmail)
	})

	runServiceTest(t, "returns ErrPasswordTooShort and does not call store for short password", func(t *testing.T, service userService, _ *stubUserStore) {
		updated, err := service.UpdateUser(context.Background(), uuid.New(), UpdateUserInput{Password: stringPtr("S!ort1")})

		assert.Nil(t, updated)
		assert.ErrorIs(t, err, ErrPasswordTooShort)
	})

	runServiceTest(t, "hashes password before sending update fields to store", func(t *testing.T, service userService, store *stubUserStore) {
		ctx := context.Background()
		userID := uuid.New()
		plainPassword := "Valid!123"

		store.updateUserFn = func(_ context.Context, id uuid.UUID, fields userStore.UpdateUserFields) (*models.User, error) {
			require.Equal(t, userID, id)
			require.NotNil(t, fields.PasswordHash)
			assert.NotEqual(t, plainPassword, *fields.PasswordHash)
			assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(*fields.PasswordHash), []byte(plainPassword)))
			return &models.User{ID: id, PasswordHash: *fields.PasswordHash}, nil
		}

		updated, err := service.UpdateUser(ctx, userID, UpdateUserInput{Password: stringPtr(plainPassword)})

		require.NoError(t, err)
		require.NotNil(t, updated)
		assert.Equal(t, userID, updated.ID)
		assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(updated.PasswordHash), []byte(plainPassword)))
	})

	runServiceTest(t, "returns ErrAvatarTooLarge before store update", func(t *testing.T, service userService, _ *stubUserStore) {
		avatar := &AvatarInput{
			Filename: "avatar.png",
			File:     bytes.NewReader([]byte("avatar")),
			Size:     maxAvatarSize + 1,
		}

		updated, err := service.UpdateUser(context.Background(), uuid.New(), UpdateUserInput{Avatar: avatar})

		assert.Nil(t, updated)
		assert.ErrorIs(t, err, ErrAvatarTooLarge)
	})

	runServiceTest(t, "returns ErrAvatarSaveFailed when avatar cannot be read", func(t *testing.T, service userService, _ *stubUserStore) {
		avatar := &AvatarInput{
			Filename: "avatar.png",
			File:     failingReader{},
			Size:     1,
		}

		updated, err := service.UpdateUser(context.Background(), uuid.New(), UpdateUserInput{Avatar: avatar})

		assert.Nil(t, updated)
		assert.ErrorIs(t, err, ErrAvatarSaveFailed)
		assert.ErrorContains(t, err, "read failed")
	})

	runServiceTest(t, "clears avatar_url and deletes avatar files when RemoveAvatar is requested", func(t *testing.T, service userService, store *stubUserStore) {
		ctx := context.Background()
		userID := uuid.New()
		avatarDir := filepath.Join(service.mediaDir, "avatars", userID.String())
		require.NoError(t, os.MkdirAll(avatarDir, 0o755))
		require.NoError(t, os.WriteFile(filepath.Join(avatarDir, "original.png"), []byte("avatar"), 0o644))

		store.updateUserFn = func(_ context.Context, id uuid.UUID, fields userStore.UpdateUserFields) (*models.User, error) {
			require.Equal(t, userID, id)
			assert.True(t, fields.SetAvatarURL)
			assert.Nil(t, fields.AvatarURL)
			return &models.User{ID: id}, nil
		}

		updated, err := service.UpdateUser(ctx, userID, UpdateUserInput{RemoveAvatar: true})

		require.NoError(t, err)
		require.NotNil(t, updated)
		_, statErr := os.Stat(avatarDir)
		assert.True(t, errors.Is(statErr, os.ErrNotExist))
	})

	runServiceTest(t, "does not delete avatar files when store update fails during avatar removal", func(t *testing.T, service userService, store *stubUserStore) {
		userID := uuid.New()
		avatarDir := filepath.Join(service.mediaDir, "avatars", userID.String())
		require.NoError(t, os.MkdirAll(avatarDir, 0o755))
		require.NoError(t, os.WriteFile(filepath.Join(avatarDir, "original.png"), []byte("avatar"), 0o644))

		store.updateUserFn = func(_ context.Context, _ uuid.UUID, _ userStore.UpdateUserFields) (*models.User, error) {
			return nil, errors.New("update failed")
		}

		updated, err := service.UpdateUser(context.Background(), userID, UpdateUserInput{RemoveAvatar: true})

		assert.Nil(t, updated)
		assert.ErrorIs(t, err, ErrUserStoreFailed)
		_, statErr := os.Stat(avatarDir)
		assert.NoError(t, statErr)
	})

	runServiceTest(t, "maps duplicate email from store", func(t *testing.T, service userService, store *stubUserStore) {
		store.updateUserFn = func(_ context.Context, _ uuid.UUID, _ userStore.UpdateUserFields) (*models.User, error) {
			return nil, userStore.ErrDuplicateEmail
		}

		updated, err := service.UpdateUser(context.Background(), uuid.New(), UpdateUserInput{Email: stringPtr("valid@test.com")})

		assert.Nil(t, updated)
		assert.ErrorIs(t, err, ErrDuplicateEmail)
	})

	runServiceTest(t, "maps gorm ErrRecordNotFound to ErrUserNotFound", func(t *testing.T, service userService, store *stubUserStore) {
		store.updateUserFn = func(_ context.Context, _ uuid.UUID, _ userStore.UpdateUserFields) (*models.User, error) {
			return nil, gorm.ErrRecordNotFound
		}

		updated, err := service.UpdateUser(context.Background(), uuid.New(), UpdateUserInput{FullName: stringPtr("Updated User")})

		assert.Nil(t, updated)
		assert.ErrorIs(t, err, ErrUserNotFound)
	})

	runServiceTest(t, "wraps unexpected store errors", func(t *testing.T, service userService, store *stubUserStore) {
		store.updateUserFn = func(_ context.Context, _ uuid.UUID, _ userStore.UpdateUserFields) (*models.User, error) {
			return nil, errors.New("update failed")
		}

		updated, err := service.UpdateUser(context.Background(), uuid.New(), UpdateUserInput{FullName: stringPtr("Updated User")})

		assert.Nil(t, updated)
		assert.ErrorIs(t, err, ErrUserStoreFailed)
		assert.ErrorContains(t, err, "update failed")
	})
}

func TestUserService_DeleteAvatar(t *testing.T) {
	runServiceTest(t, "removes the user's avatar directory", func(t *testing.T, service userService, _ *stubUserStore) {
		userID := uuid.New()
		avatarDir := filepath.Join(service.mediaDir, "avatars", userID.String())
		require.NoError(t, os.MkdirAll(avatarDir, 0o755))
		require.NoError(t, os.WriteFile(filepath.Join(avatarDir, "original.png"), []byte("avatar"), 0o644))

		err := service.deleteAvatar(userID)

		assert.NoError(t, err)
		_, statErr := os.Stat(avatarDir)
		assert.True(t, errors.Is(statErr, os.ErrNotExist))
	})

	runServiceTest(t, "wraps filesystem errors", func(t *testing.T, service userService, _ *stubUserStore) {
		badMediaRoot := filepath.Join(t.TempDir(), "media-root")
		require.NoError(t, os.WriteFile(badMediaRoot, []byte("not-a-directory"), 0o644))
		service.mediaDir = badMediaRoot

		err := service.deleteAvatar(uuid.New())

		assert.ErrorIs(t, err, ErrAvatarDeleteFailed)
	})
}

func TestUserService_DeleteUser(t *testing.T) {
	runServiceTest(t, "wraps delete errors without remapping them to not found", func(t *testing.T, service userService, store *stubUserStore) {
		store.deleteUserFn = func(_ context.Context, _ uuid.UUID) error {
			return gorm.ErrRecordNotFound
		}

		err := service.DeleteUser(context.Background(), uuid.New())

		assert.ErrorIs(t, err, ErrUserStoreFailed)
		assert.True(t, errors.Is(err, gorm.ErrRecordNotFound))
		assert.False(t, errors.Is(err, ErrUserNotFound))
	})
}

func TestUserService_GetByEmailAndPassword(t *testing.T) {
	runServiceTest(t, "returns ErrUserNotFound when store returns uuid.Nil", func(t *testing.T, service userService, store *stubUserStore) {
		store.getByEmailAndPasswordFn = func(_ context.Context, email, password string) (uuid.UUID, error) {
			assert.Equal(t, "user@test.com", email)
			assert.Equal(t, "Valid!123", password)
			return uuid.Nil, nil
		}

		id, err := service.GetByEmailAndPassword(context.Background(), "user@test.com", "Valid!123")

		assert.Equal(t, uuid.Nil, id)
		assert.ErrorIs(t, err, ErrUserNotFound)
	})

	runServiceTest(t, "maps bcrypt mismatch to ErrInvalidPassword", func(t *testing.T, service userService, store *stubUserStore) {
		store.getByEmailAndPasswordFn = func(_ context.Context, _, _ string) (uuid.UUID, error) {
			return uuid.Nil, bcrypt.ErrMismatchedHashAndPassword
		}

		id, err := service.GetByEmailAndPassword(context.Background(), "user@test.com", "Wrong!123")

		assert.Equal(t, uuid.Nil, id)
		assert.ErrorIs(t, err, ErrInvalidPassword)
	})

	runServiceTest(t, "wraps store lookup errors", func(t *testing.T, service userService, store *stubUserStore) {
		store.getByEmailAndPasswordFn = func(_ context.Context, _, _ string) (uuid.UUID, error) {
			return uuid.Nil, errors.New("auth lookup failed")
		}

		id, err := service.GetByEmailAndPassword(context.Background(), "user@test.com", "Valid!123")

		assert.Equal(t, uuid.Nil, id)
		assert.ErrorIs(t, err, ErrUserFindFailed)
		assert.ErrorContains(t, err, "auth lookup failed")
	})

	runServiceTest(t, "returns the user ID from store", func(t *testing.T, service userService, store *stubUserStore) {
		expectedID := uuid.New()
		store.getByEmailAndPasswordFn = func(_ context.Context, _, _ string) (uuid.UUID, error) {
			return expectedID, nil
		}

		id, err := service.GetByEmailAndPassword(context.Background(), "user@test.com", "Valid!123")

		assert.NoError(t, err)
		assert.Equal(t, expectedID, id)
	})
}

func TestUserService_CheckPassword(t *testing.T) {
	runServiceTest(t, "returns ErrInvalidPassword for mismatched password", func(t *testing.T, service userService, _ *stubUserStore) {
		err := service.CheckPassword(mustHashPassword(t, "Valid!123"), "Wrong!123")

		assert.ErrorIs(t, err, ErrInvalidPassword)
	})

	runServiceTest(t, "accepts matching password", func(t *testing.T, service userService, _ *stubUserStore) {
		err := service.CheckPassword(mustHashPassword(t, "Valid!123"), "Valid!123")

		assert.NoError(t, err)
	})
}
