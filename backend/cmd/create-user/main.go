package main

import (
	mainDB "backend/db"
	userDB "backend/db/user"
	userService "backend/services/user"
	"context"
	"fmt"
	"log"
	"os"
)

// Create a user from CLI.
//
// Example inside Docker:
//
//	docker compose -f compose.dev.yml exec backserver go run ./cmd/create-user john john@example.com 'Password123!'
//
// Example from host:
//
//	DB_HOST=localhost DB_PORT=5432 DB_USER=stride DB_PASSWORD=stride DB_NAME=stride \
//	go run ./cmd/create-user john john@example.com 'Password123!'
func main() {
	// Expected arguments: username, email, password.
	if len(os.Args) != 4 {
		log.Fatalf("usage: go run ./cmd/create-user <username> <email> <password>")
	}

	username := os.Args[1]
	email := os.Args[2]
	password := os.Args[3]

	dbConn, err := mainDB.InitGORMDB(mainDB.PostgresDSNFromEnv())
	if err != nil {
		log.Fatal(err)
	}

	store := userDB.NewUserStore(dbConn)
	service := userService.NewUserService(store)

	createdUser, err := service.CreateUser(context.Background(), username, email, password)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("created user: id=%s username=%s email=%s\n", createdUser.ID, createdUser.Username, createdUser.Email)
}
