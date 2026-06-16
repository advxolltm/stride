package db

import (
	"embed"
	"errors"
	"fmt"
	"log"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Paginated[T any] struct {
	Items          []T
	Page           int
	PageSize       int
	PageCount      int
	TotalItemCount int
}

//go:embed migrations/*.sql
var fs embed.FS

type MigrationOptions struct {
	DropBeforeMigrate bool
}

func newMigration(postgresURL string) (*migrate.Migrate, error) {
	d, err := iofs.New(fs, "migrations")
	if err != nil {
		return nil, err
	}

	m, err := migrate.NewWithSourceInstance(
		"iofs",
		d,
		postgresURL)
	if err != nil {
		return nil, err
	}

	return m, nil
}

func closeMigration(m *migrate.Migrate) error {
	if m == nil {
		return nil
	}
	if srcErr, dbErr := m.Close(); srcErr != nil || dbErr != nil {
		return errors.Join(srcErr, dbErr)
	}
	return nil
}

func migrateDB(postgresURL string, options MigrationOptions) (*migrate.Migrate, error) {
	m, err := newMigration(postgresURL)
	if err != nil {
		return nil, err
	}

	if options.DropBeforeMigrate {
		if err := m.Drop(); err != nil && err != migrate.ErrNoChange {
			_ = closeMigration(m)
			return nil, fmt.Errorf("failed to drop database: %w", err)
		}

		if err := closeMigration(m); err != nil {
			return nil, fmt.Errorf("failed to close migration after drop: %w", err)
		}

		m, err = newMigration(postgresURL)
	}
	if err != nil {
		return nil, err
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		_ = closeMigration(m)
		return nil, fmt.Errorf("failed to run up migrations: %w", err)
	}
	return m, nil
}

func InitGORMDB(dsn string) (*gorm.DB, error) {
	var DB *gorm.DB
	var err error

	// Open the connection and configure GORM
	DB, err = gorm.Open(postgres.Open(dsn))

	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Database connection established and ORM initialized.")

	return DB, nil
}

func InitDB(postgresURL string) (*gorm.DB, *migrate.Migrate, error) {
	return InitDBWithOptions(postgresURL, MigrationOptions{DropBeforeMigrate: true})
}

func InitDBWithOptions(postgresURL string, options MigrationOptions) (*gorm.DB, *migrate.Migrate, error) {
	m, err := migrateDB(postgresURL, options)
	if err != nil {
		return nil, nil, err
	}
	gormDB, err := InitGORMDB(postgresURL)
	if err != nil {
		return nil, nil, err
	}
	return gormDB, m, nil
}

func InitRedis(redisURL string) *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr: redisURL,
	})
}
