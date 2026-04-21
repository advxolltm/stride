package testutils

import (
	"backend/db"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/testcontainers/testcontainers-go/modules/compose"
	"github.com/testcontainers/testcontainers-go/wait"
	"gorm.io/gorm"
)

var stack *compose.DockerCompose
var ctx = context.Background()

func SetupDB() {
	if os.Getenv("CI") != "" {
		SetCICDTestDB()
	} else {
		SetupDevTestDB()
	}
}

func SetCICDTestDB() {
	dsn := buildCICDTestDSN()
	waitForDatabase(dsn)
	setupTestDBFromDSN(dsn)
}

func setupTestDBFromDSN(dsn string) {
	testdb, _, err := db.InitDB(dsn)
	AssertNoError(err)

	DB = testdb
	SeedDB()
}

func buildCICDTestDSN() string {
	host := envOrDefault([]string{"DB_HOST"}, "db")
	port := envOrDefault([]string{"DB_PORT"}, "5432")
	user := envOrDefault([]string{"DB_USER", "POSTGRES_USER", "POSTGRESQL_USERNAME"}, "stride")
	password := envOrDefault([]string{"DB_PASSWORD", "POSTGRES_PASSWORD", "POSTGRESQL_PASSWORD"}, "stride")
	name := envOrDefault([]string{"DB_NAME", "POSTGRES_DB", "POSTGRESQL_DATABASE"}, "stride")

	return fmt.Sprintf("postgresql://%s:%s@%s:%s/%s?sslmode=disable", user, password, host, port, name)
}

func envOrDefault(keys []string, fallback string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}

	return fallback
}

func waitForDatabase(dsn string) {
	sqlDB, err := sql.Open("postgres", dsn)
	AssertNoError(err)
	defer func() {
		if closeErr := sqlDB.Close(); closeErr != nil {
			log.Printf("Failed to close CI test database probe: %v", closeErr)
		}
	}()

	var pingErr error
	for attempt := 1; attempt <= 30; attempt++ {
		pingErr = sqlDB.PingContext(ctx)
		if pingErr == nil {
			return
		}

		log.Printf("Waiting for CI test database (%d/30): %v", attempt, pingErr)
		time.Sleep(time.Second)
	}

	AssertNoError(pingErr)
}

func SeedDB(db *gorm.DB) {
	fillDBWithRandomData(db)
}

func TAssertNoError(t interface{ Helper(); Fatalf(string, ...any) }, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func SetupDevTestDB() *gorm.DB {
	composeReader := openDevComposeFile()
	newStack, err := compose.NewDockerComposeWith(
		compose.WithStackReaders(composeReader),
	)

	stack = newStack

	AssertNoError(err)

	err = stack.
		WithEnv(map[string]string{
			"POSTGRES_DB": "",
			"POSTGRES_USER": "",
			"POSTGRES_PASSWORD": "",
		}).
		WaitForService("db", wait.ForListeningPort("5432/tcp")).
		Up(ctx, compose.RunServices("db"), compose.Wait(true))

	dbContainer, err := stack.ServiceContainer(ctx, "db")
	AssertNoError(err)

	dbHost, err := dbContainer.Host(ctx)
	AssertNoError(err)

	dbPort, err := dbContainer.MappedPort(ctx, "5432")

	dsn := fmt.Sprintf("postgresql://stride:stride@%s:%s/stride?sslmode=disable", dbHost, dbPort.Port())
	setupTestDBFromDSN(dsn)
}

func TeardownDB() {
	if stack != nil {
		err := stack.Down(
			ctx,
			compose.RemoveOrphans(true),
			compose.RemoveVolumes(true),
			compose.RemoveImagesLocal,
		)
		if err != nil {
			log.Printf("Failed to stop stack: %v", err)
		}
	}
}

func findGoModuleRoot() string {
	_, fileName, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("findGoModuleRoot: failed to get current file")
	}

	dir := filepath.Dir(fileName)

	for {
		modFile := filepath.Join(dir, "go.mod")
		_, err := os.Stat(modFile)

		if err == nil {
			return dir
		}

		if !errors.Is(err, os.ErrNotExist) {
			log.Fatal("failed to check go.mod file: %w", err.Error())
		}

		parent := filepath.Dir(dir)
		// if we reached the root directory
		if dir == parent {
			log.Fatal("failed to find go.mod file")
		}

		dir = parent
	}
}

func openDevComposeFile() io.Reader {
	moduleRoot := findGoModuleRoot()
	composeFilePath := fmt.Sprintf("%s/../compose.dev.yml", moduleRoot)
	composeFilePath, err := filepath.Abs(composeFilePath)
	AssertNoError(err)

	log.Println("compose file path:", composeFilePath)

	file, err := os.Open(composeFilePath)
	AssertNoError(err)

	return file
}

func Assert(cond bool) {
	if !cond {
		panic("failed assert")
	}
}

func AssertNoError(err error) {
	if err != nil {
		log.Fatal("no-error assert failed: ", err)
	}
}
