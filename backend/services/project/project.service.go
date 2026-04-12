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
		GetProjectMembers(ctx context.Context, id uuid.UUID) ([]models.User, error)
		CreateProject(ctx context.Context, createdBy *uuid.UUID, name string, slug string, description *string, status string) (*models.Project, error)
		UpdateProject(ctx context.Context, id uuid.UUID, input UpdateProjectInput) (*models.Project, error)
		DeleteProject(ctx context.Context, id uuid.UUID) error
		AddUserToProject(ctx context.Context, userId uuid.UUID, projectId uuid.UUID, role string) error
		RemoveUserFromProject(ctx context.Context, userId uuid.UUID, projectId uuid.UUID) error
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

func (s projectService) GetProjectMembers(ctx context.Context, id uuid.UUID) ([]models.User, error) {
	members, err := s.projectStore.GetProjectMembers(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return members, nil
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

func (s projectService) AddUserToProject(ctx context.Context, userId uuid.UUID, projectId uuid.UUID, role string) error{

	//TODO: REFINE ERROR HANDLING

	m := &models.ProjectMember{
		UserID:   		userId,
		ProjectID:      projectId,
		Role:        	role,
	}
	err := s.projectStore.AddUserToProject(ctx, m)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return m, nil
}
func (s projectService) RemoveUserFromProject(ctx context.Context, userId uuid.UUID, projectId uuid.UUID) error{
	err := s.projectStore.RemoveUserFromProject(ctx, userId, projectId)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return nil
}