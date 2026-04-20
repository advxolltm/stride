package project

import (
	"backend/db/project"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TODO: Tests project.service.go
type UpdateProjectInput struct {
	Name        *string
	Slug        *string
	Description *string
	Status      *string
}
type AddMemberRequest struct {
	UserId uuid.UUID `json:"userid"`
	Role   string    `json:"role"`
}

type (
	ProjectService interface {
		GetAllProjects(ctx context.Context, userid *uuid.UUID) ([]models.Project, error)
		GetProject(ctx context.Context, id uuid.UUID) (*models.Project, error)
		GetProjectMembers(ctx context.Context, id uuid.UUID) ([]models.ProjectMember, error)
		GetProjectSkills(ctx context.Context, id uuid.UUID) ([]models.ProjectSkill, error)
		CreateProject(ctx context.Context, createdBy *uuid.UUID, name string, slug string, description *string, status string) (*models.Project, error)
		UpdateProject(ctx context.Context, id uuid.UUID, input UpdateProjectInput) (*models.Project, error)
		DeleteProject(ctx context.Context, id uuid.UUID) error
		AddUsersToProject(ctx context.Context, members []AddMemberRequest, projectId uuid.UUID) ([]*models.ProjectMember, error)
		RemoveUserFromProject(ctx context.Context, userId uuid.UUID, projectId uuid.UUID) error
		AddProjectSkill(ctx context.Context, projectId uuid.UUID, name string, description *string) (*models.ProjectSkill, error)
		RemoveProjectSkill(ctx context.Context, skillId uuid.UUID) error
	}
	projectService struct {
		projectStore project.ProjectStore
	}
)

// TODO ALL THE REST!!
func NewProjectService(projectStore project.ProjectStore) ProjectService {
	return &projectService{projectStore}
}

func (s projectService) GetAllProjects(ctx context.Context, userid *uuid.UUID) ([]models.Project, error) {
	project, err := s.projectStore.GetAllProjects(ctx, userid)
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

func (s projectService) GetProjectMembers(ctx context.Context, id uuid.UUID) ([]models.ProjectMember, error) {
	members, err := s.projectStore.GetProjectMembers(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return members, nil
}

func (s projectService) GetProjectSkills(ctx context.Context, id uuid.UUID) ([]models.ProjectSkill, error) {
	skills, err := s.projectStore.GetProjectSkills(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return skills, nil
}

func (s projectService) CreateProject(ctx context.Context, createdBy *uuid.UUID, name string, slug string, description *string, status string) (*models.Project, error) {

	p := &models.Project{
		CreatedBy:   createdBy,
		Name:        name,
		Slug:        slug,
		Description: description,
		Status:      status,
	}

	if status != "active" && status != "archived" {
		return nil, ErrStatusDoesNotExist
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
		UpdatedAt:   time.Now(),
	}

	if *input.Status != "active" && *input.Status != "archived" {
		return nil, ErrStatusDoesNotExist
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

func (s projectService) AddUsersToProject(ctx context.Context, members []AddMemberRequest, projectId uuid.UUID) ([]*models.ProjectMember, error) {

	//TODO: REFINE ERROR HANDLING

	var projectMembers []*models.ProjectMember

	for _, user := range members {
		m := &models.ProjectMember{
			UserID:    user.UserId,
			ProjectID: projectId,
			Role:      user.Role,
		}
		projectMembers = append(projectMembers, m)
	}
	err := s.projectStore.AddUsersToProject(ctx, projectMembers)
	if err != nil {
		switch err {
		case project.ErrProjectNotFound:
			return nil, ErrProjectNotFound
		case project.ErrNonExistentUser:
			return nil, ErrNonExistentUser
		}
		return nil, fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return projectMembers, nil
}
func (s projectService) RemoveUserFromProject(ctx context.Context, userId uuid.UUID, projectId uuid.UUID) error {
	err := s.projectStore.RemoveUserFromProject(ctx, userId, projectId)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return nil
}

func (s projectService) AddProjectSkill(ctx context.Context, projectId uuid.UUID, name string, description *string) (*models.ProjectSkill, error) {
	ps := &models.ProjectSkill{
		ProjectID:   projectId,
		Name:        name,
		Description: description,
	}
	err := s.projectStore.AddProjectSkill(ctx, ps)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return ps, nil
}

func (s projectService) RemoveProjectSkill(ctx context.Context, skillId uuid.UUID) error {
	err := s.projectStore.RemoveProjectSkill(ctx, skillId)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrProjectStoreFailed, err)
	}
	return nil
}
