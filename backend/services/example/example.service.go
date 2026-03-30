package example

import (
	"backend/db/example"
	"fmt"
)

type (
	// NOTE: capitalizing the first letter makes it public
	// Therefore, we make one interface and one struct with the same name, only differing in the first letter, making the interface public but the struct (package-)private
	ExampleService interface {
		GetData() (string, error)
	}

	exampleService struct {
		// NOTE: interfaces are always pointers, so no `*example.ExampleStore` is necessary
		exampleStore example.ExampleStore
	}
)

func NewExampleService(exampleStore example.ExampleStore) ExampleService {
	return &exampleService{exampleStore}
}

func (s exampleService) GetData() (string, error) {
	value, err := s.exampleStore.FetchData()
	if err != nil {
		// NOTE: to provide some sort of a trace where an error actually originated, use `%w` which `wraps` an error inside another.
		// Printing the top-most error will then provide a nice trace
		return "", fmt.Errorf("database probably crashed: %w", err)
	}

	return fmt.Sprintf("lucky number of the day: %d", value), nil
}
