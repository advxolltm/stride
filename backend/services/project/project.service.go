package project

import (
	"backend/db/project"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"net/mail"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

//TODO: Tests project.service.go
type UpdateProjectInput struct {
	Name			*string
    Slug 			*string
    Description 	*string
    Status 			*string
}

type (
	ProjectService interface {
		GetAllProjects(ctx context.Context) ([]models.Project, error)
		GetProject(ctx context.Context, id uuid.UUID) (*models.Project, error)
		CreateProject(ctx context.Context, name string, description string, status string, createdby uuid.UUID, slug string) (*models.Project, error)
		UpdateProject(ctx context.Context, id uuid.UUID, input UpdateProjectInput) (*models.Project, error)
		DeleteProject(ctx context.Context, id uuid.UUID) error
	}
	projectService struct {
		projectStore	project.ProjectStore
	}
)

//TODO ALL THE REST!!
func NewProjectService(projectStore project.ProjectStore) ProjectService {
	return &projectService{projectStore}
}

func (s projectService) GetAllProjects(ctx context.Context) ([]models.Project, error) {
	project, err := s.projectStore.GetAllProjects(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return project, nil
}

func (s projectService) GetProject(ctx context.Context, id uuid.UUID) (*models.Project, error) {
	p, err := s.projectStore.GetProject(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProjectNotFound
		}
		return nil, fmt.Errorf("%w: %w", ErrProjectNotFound, err)
	}
	return p, nil
}

func (s projectService) CreateProject(ctx context.Context, createdBy *uuid.UUID, name string, slug string, description *string, status string) (*models.User, error) {

	p := &models.Project{
		CreatedBy:   createdBy,
		Name:        name,
		Slug:        slug,
		Description: description,
		Status:      status,
	}
	err := s.projectStore.CreateProject(ctx, p)
	if err != nil {
		if errors.Is(err, project.ErrDuplicateSlug) {
			return nil, ErrDuplicateSlug
		}
		return nil, fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return p, nil
}


func (s projectService) UpdateProject(ctx context.Context, id uuid.UUID, input UpdateProjectInput) (*models.Project, error) {
	fields := project.UpdateProjectFields{
		Name:        input.Name,
		Slug:        input.Slug,
		Description: input.Description,
		Status:      input.Status,
		UpdatedAt:	 time.Now()
	}

	p, err := s.projectStore.UpdateProject(ctx, id, fields)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProjectNotFound
		}
		return nil, fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return p, nil
}

func (s projectService) DeleteProject(ctx context.Context, id uuid.UUID) error {
	err := s.projectStore.DeleteProject(ctx, id)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return nil
}