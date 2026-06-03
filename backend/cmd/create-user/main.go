package main

import (
	mainDB "backend/db"
	userDB "backend/db/user"
	userService "backend/services/user"
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
)

// Create a user from CLI.
//
// Example inside Docker:
//
//	docker compose -f compose.dev.yml exec backserver go run ./cmd/create-user john john@example.com 'Password123!'
//	docker compose -f compose.dev.yml exec backserver go run ./cmd/create-user --superuser admin admin@example.com 'Password123!'
//	printf '%s\n' 'Password123!' | docker compose -f compose.dev.yml exec -T backserver go run ./cmd/create-user --superuser --password-stdin admin admin@example.com
//
// Example from host:
//
//	DB_HOST=localhost DB_PORT=5432 DB_USER=stride DB_PASSWORD=stride DB_NAME=stride \
//	go run ./cmd/create-user john john@example.com 'Password123!'
func main() {
	superuser := flag.Bool("superuser", false, "create the user with superuser permissions")
	passwordStdin := flag.Bool("password-stdin", false, "read the password from stdin instead of an argument")
	flag.Usage = func() {
		_, _ = fmt.Fprintf(os.Stderr, "usage: go run ./cmd/create-user [--superuser] [--password-stdin] <username> <email> [password]\n")
	}
	flag.Parse()

	args := flag.Args()
	if (!*passwordStdin && len(args) != 3) || (*passwordStdin && len(args) != 2) {
		flag.Usage()
		os.Exit(2)
	}

	username := args[0]
	email := args[1]
	password := ""
	if *passwordStdin {
		passwordBytes, err := io.ReadAll(os.Stdin)
		if err != nil {
			log.Fatal(err)
		}
		password = strings.TrimRight(string(passwordBytes), "\r\n")
	} else {
		password = args[2]
	}

	dbConn, err := mainDB.InitGORMDB(mainDB.PostgresDSNFromEnv())
	if err != nil {
		log.Fatal(err)
	}

	store := userDB.NewUserStore(dbConn)
	service := userService.NewUserService(store)

	createdUser, err := service.CreateUserWithOptions(
		context.Background(),
		username,
		email,
		password,
		userService.CreateUserOptions{IsSuperuser: *superuser},
	)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("created user: id=%s username=%s email=%s is_superuser=%t\n", createdUser.ID, createdUser.Username, createdUser.Email, createdUser.IsSuperuser)
}
