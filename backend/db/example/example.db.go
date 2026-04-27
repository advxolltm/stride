package example

import (
	"errors"
	"math/rand"
)

type (
	ExampleStore interface {
		FetchData() (int, error)
	}

	exampleStore struct {
		connectionString string
	}
)

func NewExampleStore(connectionString string) ExampleStore {
	return &exampleStore{connectionString}
}

func (db exampleStore) FetchData() (int, error) {
	if rand.Intn(2) == 1 {
		// NOTE: The 0 is just a placeholder / default value
		// The caller of the function always has to check for error first before using the actual data!
		return 0, errors.New("oh no! something went horribly wrong :(")
	} else {
		// NOTE: "no error" is indicated by returning nil for the error value
		return 43, nil
	}
}
