package project

import (
	"backend/db"
	"backend/models"
	"context"
	"errors"
	"strings"
	"time"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TODO: Tests project.db.go
type UpdateProjectFields struct {
	Name			*string `gorm:"column:name"`
    Slug 			*string `gorm:"column:slug"`
    Description 	*string `gorm:"column:description"`
    Status 			*string `gorm:"column:status"`
	UpdatedAt		time.Time `gorm:"column:updated_at"`
}

type (
	ProjectStore interface {
		GetAllProjects(ctx context.Context) ([]models.Project, error)
		GetProject(ctx context.Context, id uuid.UUID) (*models.Project, error)
		GetProjectMembers(ctx context.Context, id uuid.UUID) ([]models.ProjectMember, error)
		GetProjectSkills(ctx context.Context, id uuid.UUID) ([]models.ProjectSkill, error)
		CreateProject(ctx context.Context, project *models.Project) error
		UpdateProject(ctx context.Context, id uuid.UUID, input UpdateProjectFields) (*models.Project, error)
		DeleteProject(ctx context.Context, id uuid.UUID) error
		AddUsersToProject(ctx context.Context, projectmembers []*models.ProjectMember) error
		RemoveUserFromProject(ctx context.Context, userId uuid.UUID, projectId uuid.UUID) error
		AddProjectSkill(ctx context.Context, projectSkill *models.ProjectSkill) error
		RemoveProjectSkill(ctx context.Context, id uuid.UUID) error

	}

	projectStore struct {
		db *gorm.DB
	}
)

func NewProjectStore(db *gorm.DB) ProjectStore {
	return &projectStore{db}
}

func (s *projectStore) GetAllProjects(ctx context.Context) ([]models.Project, error) {
	var projects []models.Project
	result := s.db.WithContext(ctx).Find(&projects)
	if result.Error != nil {
		return nil, result.Error
	}
	return projects, nil
}

func (s *projectStore) GetProject(ctx context.Context, id uuid.UUID) (*models.Project, error) {
	var project models.Project
	result := s.db.WithContext(ctx).First(&project, "id = ?", id)
	if result.Error != nil {
		return nil, result.Error
	}
	return &project, nil
}

func (s *projectStore) GetProjectMembers(ctx context.Context, id uuid.UUID) ([]models.ProjectMember, error) {
	var project models.Project

	result := s.db.Preload("Members").Preload("Members.User").First(&project, id)
	if result.Error != nil {
		return nil, result.Error
	}
	return project.Members, nil
}

func (s *projectStore) GetProjectSkills(ctx context.Context, id uuid.UUID) ([]models.ProjectSkill, error) {
	var project models.Project

	result := s.db.Preload("Skills").First(&project, id)
	if result.Error != nil {
		return nil, result.Error
	}
	return project.Skills, nil
}

func (s *projectStore) CreateProject(ctx context.Context, project *models.Project) error {
	result := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(project).Error; err != nil {
            if strings.Contains(err.Error(), "duplicate key") {
                return ErrDuplicateSlug
            }
            return err
        }

		if project.CreatedBy != nil {
            member := &models.ProjectMember{
                ProjectID: project.ID,
                UserID:    *project.CreatedBy,
                Role:      "owner",
            }
            if err := tx.Create(member).Error; err != nil {
                return err
            }
        }

        return nil
	})

	if result != nil {
		return fmt.Errorf("failed to create project and link owner: %w", result)
	}
	return nil
}

func (s *projectStore) UpdateProject(ctx context.Context, id uuid.UUID, fields UpdateProjectFields) (*models.Project, error) {
	var project models.Project
	result := s.db.WithContext(ctx).Model(&project).
		Clauses(clause.Returning{}).
		Where("id = ?", id).
		Updates(fields)
	if result.Error != nil {
		var pgErr *pgconn.PgError
		if errors.As(result.Error, &pgErr) && pgErr.Code == db.UniqueConstraintViolationCode {
			if strings.Contains(pgErr.ConstraintName, "slug") {
				return nil, ErrDuplicateSlug
			}
		}
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &project, nil
}

func (s *projectStore) DeleteProject(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).Delete(&models.Project{}, "id = ?", id)
	if result.Error != nil {
		return gorm.ErrRecordNotFound
	}
	if result.RowsAffected == 0 {
    	return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *projectStore) AddUsersToProject(ctx context.Context, projectmembers []*models.ProjectMember) error {
	result := s.db.WithContext(ctx).Create(&projectmembers)
	if result.Error != nil {
		var pgErr *pgconn.PgError
		if errors.As(result.Error, &pgErr) {
			if pgErr.Code == "23503" { //Foreign key violation
				switch pgErr.ConstraintName {
				case "project_members_user_id_fkey":
					return ErrNonExistentUser
				case "project_members_project_id_fkey":
					return ErrProjectNotFound
				}
			}
		}
		return result.Error
	}
	return nil
}


func (s *projectStore) RemoveUserFromProject(ctx context.Context, userId uuid.UUID, projectId uuid.UUID) error {
	result := s.db.WithContext(ctx).Where("user_id = ? AND project_id = ?", userId, projectId).Delete(&models.ProjectMember{})
	if result.Error != nil {
		return gorm.ErrRecordNotFound
	}
	if result.RowsAffected == 0 {
    	return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *projectStore) AddProjectSkill(ctx context.Context, projectSkill *models.ProjectSkill) error {
	result := s.db.WithContext(ctx).Create(projectSkill)
	if result.Error != nil {
		return result.Error
	}
	return nil
}

func (s *projectStore) RemoveProjectSkill(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).Where("id = ?", id).Delete(&models.ProjectSkill{})
	if result.Error != nil {
		return gorm.ErrRecordNotFound
	}
	if result.RowsAffected == 0 {
    	return gorm.ErrRecordNotFound
	}
	return nil
}
