package user_test

import (
	userStore "backend/db/user"
	"backend/models"
	"backend/testutils"
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var db *gorm.DB

func TestMain(m *testing.M) {
	db = testutils.SetupDB()
	db = db.Begin()
	testutils.SeedDB(db)
	exitCode := m.Run()
	db.Rollback()
	testutils.TeardownDB()
	os.Exit(exitCode)
}

func newStore(tx *gorm.DB) userStore.UserStore {
	return userStore.NewUserStore(tx)
}

func runTest(t *testing.T, name string, f func(*testing.T, userStore.UserStore)) {
	t.Helper()
	t.Run(name, func(t *testing.T) {
		_ = db.Transaction(func(tx *gorm.DB) error {
			f(t, newStore(tx))
			return fmt.Errorf("rollback after %s", t.Name())
		})
	})
}

func makeUser(username, email string) *models.User {
	hash, _ := bcrypt.GenerateFromPassword([]byte("P@ssword1!"), bcrypt.MinCost)
	return &models.User{
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
	}
}

// uniqueSuffix returns a short random string to make names unique per test run.
func uniqueSuffix() string {
	return uuid.NewString()[:8]
}


func TestUserStore_GetAllUsers(t *testing.T) {
	runTest(t, "returns seeded users (non-empty)", func(t *testing.T, s userStore.UserStore) {
		users, err := s.GetAllUsers(context.Background())
		require.NoError(t, err)
		assert.NotEmpty(t, users)
	})

	runTest(t, "count increases after insert", func(t *testing.T, s userStore.UserStore) {
		before, err := s.GetAllUsers(context.Background())
		require.NoError(t, err)

		u := makeUser("cnt-"+uniqueSuffix(), "cnt-"+uniqueSuffix()+"@test.com")
		require.NoError(t, s.CreateUser(context.Background(), u))

		after, err := s.GetAllUsers(context.Background())
		require.NoError(t, err)
		assert.Equal(t, len(before)+1, len(after))
	})
}


func TestUserStore_CreateUser(t *testing.T) {
	runTest(t, "assigns a non-nil UUID and persists all fields", func(t *testing.T, s userStore.UserStore) {
		u := makeUser("crt-"+uniqueSuffix(), "crt-"+uniqueSuffix()+"@test.com")
		err := s.CreateUser(context.Background(), u)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, u.ID)
		assert.NotEmpty(t, u.Username)
		assert.NotEmpty(t, u.Email)
		assert.NotEmpty(t, u.PasswordHash)
	})

	runTest(t, "returns ErrDuplicateEmail for duplicate email", func(t *testing.T, s userStore.UserStore) {
		email := "dup-email-" + uniqueSuffix() + "@test.com"
		u1 := makeUser("u1-"+uniqueSuffix(), email)
		require.NoError(t, s.CreateUser(context.Background(), u1))

		u2 := makeUser("u2-"+uniqueSuffix(), email)
		err := s.CreateUser(context.Background(), u2)
		assert.ErrorIs(t, err, userStore.ErrDuplicateEmail)
	})

	runTest(t, "returns ErrDuplicateUsername for duplicate username", func(t *testing.T, s userStore.UserStore) {
		username := "dup-usr-" + uniqueSuffix()
		u1 := makeUser(username, "e1-"+uniqueSuffix()+"@test.com")
		require.NoError(t, s.CreateUser(context.Background(), u1))

		u2 := makeUser(username, "e2-"+uniqueSuffix()+"@test.com")
		err := s.CreateUser(context.Background(), u2)
		assert.ErrorIs(t, err, userStore.ErrDuplicateUsername)
	})
}


func TestUserStore_GetUser(t *testing.T) {
	runTest(t, "returns the user with correct fields", func(t *testing.T, s userStore.UserStore) {
		u := makeUser("get-"+uniqueSuffix(), "get-"+uniqueSuffix()+"@test.com")
		require.NoError(t, s.CreateUser(context.Background(), u))

		fetched, err := s.GetUser(context.Background(), u.ID)
		require.NoError(t, err)
		assert.Equal(t, u.ID, fetched.ID)
		assert.Equal(t, u.Username, fetched.Username)
		assert.Equal(t, u.Email, fetched.Email)
	})

	runTest(t, "returns gorm.ErrRecordNotFound for unknown ID", func(t *testing.T, s userStore.UserStore) {
		_, err := s.GetUser(context.Background(), uuid.New())
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}

func TestUserStore_UpdateUser(t *testing.T) {
	runTest(t, "updates email and returns updated record via RETURNING", func(t *testing.T, s userStore.UserStore) {
		u := makeUser("upd-email-"+uniqueSuffix(), "old-"+uniqueSuffix()+"@test.com")
		require.NoError(t, s.CreateUser(context.Background(), u))

		newEmail := "new-" + uniqueSuffix() + "@test.com"
		updated, err := s.UpdateUser(context.Background(), u.ID, userStore.UpdateUserFields{Email: &newEmail})
		require.NoError(t, err)
		assert.Equal(t, u.ID, updated.ID)
		assert.Equal(t, newEmail, updated.Email)
	})

	runTest(t, "updates full_name and reflects it in returned record", func(t *testing.T, s userStore.UserStore) {
		u := makeUser("upd-name-"+uniqueSuffix(), "upd-name-"+uniqueSuffix()+"@test.com")
		require.NoError(t, s.CreateUser(context.Background(), u))

		name := "Full Name"
		updated, err := s.UpdateUser(context.Background(), u.ID, userStore.UpdateUserFields{FullName: &name})
		require.NoError(t, err)
		require.NotNil(t, updated.FullName)
		assert.Equal(t, name, *updated.FullName)
	})

	runTest(t, "updates password_hash and the new hash is persisted", func(t *testing.T, s userStore.UserStore) {
		u := makeUser("upd-pw-"+uniqueSuffix(), "upd-pw-"+uniqueSuffix()+"@test.com")
		require.NoError(t, s.CreateUser(context.Background(), u))

		newHash, err := bcrypt.GenerateFromPassword([]byte("N3wP@ss!"), bcrypt.MinCost)
		require.NoError(t, err)
		hashStr := string(newHash)

		_, err = s.UpdateUser(context.Background(), u.ID, userStore.UpdateUserFields{PasswordHash: &hashStr})
		require.NoError(t, err)

		fetched, err := s.GetUser(context.Background(), u.ID)
		require.NoError(t, err)
		assert.Equal(t, hashStr, fetched.PasswordHash)
	})

	runTest(t, "returns gorm.ErrRecordNotFound for unknown ID", func(t *testing.T, s userStore.UserStore) {
		name := "Ghost"
		_, err := s.UpdateUser(context.Background(), uuid.New(), userStore.UpdateUserFields{FullName: &name})
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})

	runTest(t, "returns ErrDuplicateEmail when email already belongs to another user", func(t *testing.T, s userStore.UserStore) {
		takenEmail := "taken-" + uniqueSuffix() + "@test.com"
		other := makeUser("other-"+uniqueSuffix(), takenEmail)
		require.NoError(t, s.CreateUser(context.Background(), other))

		u := makeUser("tgt-"+uniqueSuffix(), "tgt-"+uniqueSuffix()+"@test.com")
		require.NoError(t, s.CreateUser(context.Background(), u))

		_, err := s.UpdateUser(context.Background(), u.ID, userStore.UpdateUserFields{Email: &takenEmail})
		assert.ErrorIs(t, err, userStore.ErrDuplicateEmail)
	})
}


func TestUserStore_DeleteUser(t *testing.T) {
	runTest(t, "removes the user so GetUser returns gorm.ErrRecordNotFound", func(t *testing.T, s userStore.UserStore) {
		u := makeUser("del-"+uniqueSuffix(), "del-"+uniqueSuffix()+"@test.com")
		require.NoError(t, s.CreateUser(context.Background(), u))

		require.NoError(t, s.DeleteUser(context.Background(), u.ID))

		_, err := s.GetUser(context.Background(), u.ID)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})

	runTest(t, "returns gorm.ErrRecordNotFound for unknown ID", func(t *testing.T, s userStore.UserStore) {
		err := s.DeleteUser(context.Background(), uuid.New())
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}


func TestUserStore_GetByEmailAndPassword(t *testing.T) {
	runTest(t, "returns the user ID for correct email and password", func(t *testing.T, s userStore.UserStore) {
		plainPw := "P@ssword1!"
		hash, _ := bcrypt.GenerateFromPassword([]byte(plainPw), bcrypt.MinCost)
		u := &models.User{
			Username:     "auth-" + uniqueSuffix(),
			Email:        "auth-" + uniqueSuffix() + "@test.com",
			PasswordHash: string(hash),
		}
		require.NoError(t, s.CreateUser(context.Background(), u))

		id, err := s.GetByEmailAndPassword(context.Background(), u.Email, plainPw)
		require.NoError(t, err)
		assert.Equal(t, u.ID, id)
	})

	runTest(t, "returns uuid.Nil (no error) when email does not exist", func(t *testing.T, s userStore.UserStore) {
		id, err := s.GetByEmailAndPassword(context.Background(), "nobody-"+uniqueSuffix()+"@test.com", "P@ssword1!")
		require.NoError(t, err)
		assert.Equal(t, uuid.Nil, id)
	})

	runTest(t, "returns an error when password does not match", func(t *testing.T, s userStore.UserStore) {
		hash, _ := bcrypt.GenerateFromPassword([]byte("P@ssword1!"), bcrypt.MinCost)
		u := &models.User{
			Username:     "wrongpw-" + uniqueSuffix(),
			Email:        "wrongpw-" + uniqueSuffix() + "@test.com",
			PasswordHash: string(hash),
		}
		require.NoError(t, s.CreateUser(context.Background(), u))

		_, err := s.GetByEmailAndPassword(context.Background(), u.Email, "WrongPass!")
		assert.Error(t, err)
	})
}
