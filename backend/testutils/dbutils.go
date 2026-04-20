package testutils

import (
	"backend/db"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/testcontainers/testcontainers-go/modules/compose"
	"github.com/testcontainers/testcontainers-go/wait"
	"gorm.io/gorm"
)

var stack *compose.DockerCompose
var ctx = context.Background()

func SetupDBFromEnv() *gorm.DB {
	dsn := db.PostgresDSNFromEnv()

	testdb, _, err := db.InitDB(dsn)
	AssertNoError(err)

	return testdb
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

func SetupDB() *gorm.DB {
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


	dsn := fmt.Sprintf(
		"postgresql://%s:%s@%s:%s/%s?sslmode=disable",
		"stride",
		"stride",
		dbHost,
		dbPort.Port(),
		"stride",
	)

	testdb, _, err := db.InitDB(dsn)
	AssertNoError(err)

	return testdb
}

func TeardownDB() {
	// the testcontainers ryuk container manages cleanup automatically
	// therefore it is currently better not to do manual cleanup
	// this also allows other tests from different packages to reuse the container
	// which improves test-time
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
