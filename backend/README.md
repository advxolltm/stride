# STRIDE backend

## Local Build

You can just run the server using the following command:

```bash
go run cmd/server.go
```

If you want to build an executable, run the following command which puts the binary in the `./bin/` directory:

```bash
go build -o bin/server cmd/server.go
```

## Application Mode

`APPLICATION_MODE` controls who can create users.

- `closed_network` (default): public registration through `POST /users` remains enabled.
- `closed_auth`: public registration is disabled. `POST /users` requires an authenticated user with `is_superuser=true`.
- `open_network`: legacy alias for `closed_auth`.

Create the first superuser with the CLI:

```bash
go run ./cmd/create-user --superuser admin admin@example.com 'Password123!'
```

To avoid passing the password as a process argument, read it from stdin:

```bash
printf '%s\n' 'Password123!' | go run ./cmd/create-user --superuser --password-stdin admin admin@example.com
```

Create a normal user with the same command without the flag:

```bash
go run ./cmd/create-user john john@example.com 'Password123!'
```

Inside Docker:

```bash
docker compose -f compose.dev.yml exec backserver go run ./cmd/create-user --superuser admin admin@example.com 'Password123!'
```

Production images include `/app/stride-create-user` for the same purpose.

## Generate OpenAPI / Swagger documentation

We use [swaggo/swag](https://github.com/swaggo/swag) for API documenation. When run, the tool parses special comments in the [Delcarative Comments Format](https://github.com/swaggo/swag#declarative-comments-format).

### Install

Please note that since we are using `echo/v5` it is unfortunately not possible to use `swaggo/swag` (v1), but rather we need to use `swaggo/swag/v2` which is currently not fully released. This also means that you **cannot** install it via `go install ...`. However, getting the binary is very simple:

- for linux and macos: just download the [latest release](https://github.com/swaggo/swag/releases/tag/v2.0.0-rc5) and unpack the `.tar.gz`
- for windows: just download the [source code](https://github.com/swaggo/swag/releases/tag/v2.0.0-rc5) and then build the project using `go build ./cmd/swag.go` (or use the provided `Makefile`)

### Usage

Note: I will refer to the binary with `swag`, however, when running the following commands you obviously need to provide a correct path to the binary.

#### Help

Firstly, use `swag help`, `swag init help` and `swag fmt help` to get an overview of the CLI.

#### Generate documentation

The `swag init` command requires a path to the file containing the general api definition (in our case: `cmd/server.go`) and a list of directories to search through for the route comments (in our case: `routes`).

To generate the documentation, run the following command:

```
swag init -g server.go -d ./cmd,./routes
```

Note that you should not use `-g cmd/server.go` since `swag` automatically prepends the paths specified in `-d ...`

#### Format documentation

For consistency, please always format the documentation before committing, this can be done similarly to the `init` command:

```
swag fmt -g server.go -d ./cmd,./routes
```

## Generate OpenAPI / Swagger documentation

We use [swaggo/swag](https://github.com/swaggo/swag) for API documenation. When run, the tool parses special comments in the [Delcarative Comments Format](https://github.com/swaggo/swag#declarative-comments-format).

### Install

Please note that since we are using `echo/v5` it is unfortunately not possible to use `swaggo/swag` (v1), but rather we need to use `swaggo/swag/v2` which is currently not fully released. This also means that you **cannot** install it via `go install ...`. However, getting the binary is very simple:

- for linux and macos: just download the [latest release](https://github.com/swaggo/swag/releases/tag/v2.0.0-rc5) and unpack the `.tar.gz`
- for windows: just download the [source code](https://github.com/swaggo/swag/releases/tag/v2.0.0-rc5) and then build the project using `go build ./cmd/swag.go` (or use the provided `Makefile`)

### Usage

Note: I will refer to the binary with `swag`, however, when running the following commands you obviously need to provide a correct path to the binary.

#### Help

Firstly, use `swag help`, `swag init help` and `swag fmt help` to get an overview of the CLI.

#### Generate documentation

The `swag init` command requires a path to the file containing the general api definition (in our case: `cmd/server.go`) and a list of directories to search through for the route comments (in our case: `routes`).

To generate the documentation, run the following command:

```
swag init -g server.go -d ./cmd,./routes
```

Note that you should not use `-g cmd/server.go` since `swag` automatically prepends the paths specified in `-d ...`

#### Format documentation

For consistency, please always format the documentation before committing, this can be done similarly to the `init` command:

```
swag fmt -g server.go -d ./cmd,./routes
```

## Testing

For local testing you need to open terminal in backend's root and run this command

```bash
go test -count=1 -p 1 ./...
```

You need to make sure test aren't failing before creating PR

## Static Analysis

### govulncheck

```bash
govulncheck -show verbose ./...
```

### golangci-lint

From the backend root:

```bash
mkdir -p bin
curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b ./bin v2.12.0
```

Then run:

```bash
./bin/golangci-lint run
```

### How test setup works (`RunTestMain`)

```go
func RunTestMain(m *testing.M, pDB **gorm.DB, seed bool, withTransaction bool)
```

| Parameter         | Type         | Description                                                                                                                             |
| ----------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `m`               | `*testing.M` | The test runner provided by Go's `TestMain`. Used to execute the test suite via `m.Run()`.                                              |
| `pDB`             | `**gorm.DB`  | Pointer to the package-level `*gorm.DB` variable. Set before tests run so every test in the package can access the database.            |
| `seed`            | `bool`       | If `true`, populates the database with random fake data before running tests. Useful when tests rely on pre-existing records.           |
| `withTransaction` | `bool`       | If `true`, wraps the entire test suite in a single transaction that is rolled back after `m.Run()` returns, keeping the database clean. |

Each test package uses `testutils.RunTestMain` as its `TestMain` entry point. Here is what it does step by step:

1. **Start a database** — spins up a PostgreSQL container via Testcontainers (local) or connects to an existing DB using environment variables (`DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`) when running in CI (`CI=true`).
2. **Wrap in a transaction** _(when `withTransaction=true`)_ — the entire test suite runs inside a single database transaction, ensuring full isolation.
3. **Seed the database** _(when `seed=true`)_ — fills the database with random fake data via `SeedDB` before any test runs.
4. **Run tests** — calls `m.Run()` to execute all tests in the package.
5. **Roll back the transaction** — all changes made during the tests (including seeded data) are discarded, leaving the database clean.
6. **Exit** — calls `os.Exit` with the test result code.

Individual tests can add another layer of isolation by wrapping their logic in `db.Transaction(...)` with a forced rollback, so each test case starts from a known state.
