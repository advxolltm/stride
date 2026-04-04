package db


import (
    "log"

    "github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func migrateDB(postgresURL string) (*migrate.Migrate, error) {
    m, err := migrate.New(
		"file://db/migrations",
		postgresURL)
	if err != nil {
		log.Fatal(err)
	}
	if err := m.Up(); err != nil {
		log.Fatal(err)
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