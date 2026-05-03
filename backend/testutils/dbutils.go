package testutils

import (
	"backend/db"
	"context"
	"fmt"
	"log"
	"os"
	"testing"

	"github.com/redis/go-redis/v9"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	redisTestcontainers "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
	"gorm.io/gorm"
)

var ctx = context.Background()

// SetupDBAndRedisFromEnv connects to an existing database using environment variables
// (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME).
func SetupDBAndRedisFromEnv() (*gorm.DB, *redis.Client) {
	postgresDSN := db.PostgresDSNFromEnv()

	testdb, _, err := db.InitDB(postgresDSN)
	AssertNoError(err)

	redisDSN := db.RedisDSNFromEnv()
	testRedis := db.InitRedis(redisDSN)

	return testdb, testRedis
}

func SeedDB(db *gorm.DB) {
	fillDBWithRandomData(db)
}

func TAssertNoError(t interface {
	Helper()
	Fatalf(string, ...any)
}, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TAssertError(t interface {
	Helper()
	Fatalf(string, ...any)
}, err error) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error: %v", err)
	}
}

func SetupDB() (*gorm.DB, *redis.Client) {
	if os.Getenv("CI") == "true" {
		return SetupDBAndRedisFromEnv()
	}
	return setupDBAndRedisWithTestcontainers()
}

func setupDBAndRedisWithTestcontainers() (*gorm.DB, *redis.Client) {
	return setupDBWithTestcontainers(), setupRedisWithTestcontainers()
}

func setupRedisWithTestcontainers() *redis.Client {
	redisContainer, err := redisTestcontainers.Run(
		ctx,
		"redis:8.4-alpine",
		testcontainers.WithWaitStrategy(
			wait.ForListeningPort("6379/tcp"),
		),
	)
	AssertNoError(err)

	rHost, err := redisContainer.Host(ctx)
	AssertNoError(err)

	rPort, err := redisContainer.MappedPort(ctx, "6379")
	AssertNoError(err)

	return db.InitRedis(fmt.Sprintf("%s:%s", rHost, rPort.Port()))
}

func setupDBWithTestcontainers() *gorm.DB {
	pgContainer, err := postgres.Run(
		ctx,
		"postgres:16-alpine",
		postgres.WithDatabase("stride"),
		postgres.WithUsername("stride"),
		postgres.WithPassword("stride"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").WithOccurrence(2),
			wait.ForListeningPort("5432/tcp"),
		),
	)
	AssertNoError(err)

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	AssertNoError(err)

	testdb, _, err := db.InitDB(connStr)
	AssertNoError(err)

	return testdb
}

func TeardownDB() {
	// the testcontainers ryuk container manages cleanup automatically
	// therefore it is currently better not to do manual cleanup
	// this also allows other tests from different packages to reuse the container
	// which improves test-time
}

// RunTestMain is the generic TestMain helper for all test packages.
//
// pDB must point to the package-level *gorm.DB variable; it is set before
// m.Run() so every test in the package can use it.
//
// seed: if true, fills the database with random fake data via SeedDB.
//
// withTransaction: if true, the whole test suite runs inside a database
// transaction that is rolled back after m.Run() returns, giving full
// isolation at zero cost.
//
// The function always calls os.Exit and therefore never returns.
func RunTestMain(m *testing.M, pDB **gorm.DB, rdb **redis.Client, seed bool, withTransaction bool) {
	testDB, testRedis := SetupDB()

	if withTransaction {
		testDB = testDB.Begin()
	}

	*pDB = testDB

	if seed {
		SeedDB(testDB)
	}

	*rdb = testRedis

	code := m.Run()

	if withTransaction {
		testDB.Rollback()
	}

	TeardownDB()
	os.Exit(code)
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
