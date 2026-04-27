package db

import (
	"embed"
	"log"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var fs embed.FS

func migrateDB(postgresURL string) (*migrate.Migrate, error) {
	d, err := iofs.New(fs, "migrations")
	if err != nil {
		log.Fatal(err)
	}

	m, err := migrate.NewWithSourceInstance(
		"iofs",
		d,
		postgresURL)
	if err != nil {
		log.Fatal(err)
	}

	if err := m.Drop(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("failed to drop database: %s", err.Error())
	}

	if srcErr, dbErr := m.Close(); srcErr != nil || dbErr != nil {
		log.Fatalf("failed to close migrate: src=%s, db=%s", srcErr.Error(), dbErr.Error())
	}

	m, err = migrate.NewWithSourceInstance(
		"iofs",
		d,
		postgresURL)
	if err != nil {
		log.Fatal(err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("failed to run up migrations: %s", err.Error())
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
	m, err := migrateDB(postgresURL)
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
