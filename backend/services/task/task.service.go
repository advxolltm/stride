package task

import (
	taskStore "backend/db/task"
	"backend/models"
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type (
	UpdateTaskFields struct {
		Title                   *string
		Description             **string
		Status                  *string
		StartDate               **time.Time
		DueDate                 **time.Time
		ExpectedDurationMinutes **int
	}

	TaskService interface {
		GetTask(ctx context.Context, id uuid.UUID) (*models.Task, error)
		GetTasksForProject(ctx context.Context, projectID uuid.UUID) ([]models.Task, error)
		GetTasksAssignedToProjectMember(ctx context.Context, projectMemberID uuid.UUID) ([]models.TaskAssignee, error)
		CreateTask(ctx context.Context, task *models.Task) error
		UpdateTask(ctx context.Context, id uuid.UUID, fields UpdateTaskFields) (*models.Task, error)
		DeleteTask(ctx context.Context, id uuid.UUID) error
		AssignTask(ctx context.Context, taskID uuid.UUID, projectMemberID uuid.UUID) (*models.TaskAssignee, error)
		UnassignTask(ctx context.Context, taskID uuid.UUID, projectMemberID uuid.UUID) error
		MoveTask(ctx context.Context, id uuid.UUID, pos int) error
	}

	taskService struct {
		taskStore taskStore.TaskStore
	}
)

// AssignTask implements [TaskService].
func (t *taskService) AssignTask(ctx context.Context, taskID uuid.UUID, projectMemberID uuid.UUID) (*models.TaskAssignee, error) {
	return t.taskStore.AssignTask(ctx, taskID, projectMemberID)
}

// CreateTask implements [TaskService].
func (t *taskService) CreateTask(ctx context.Context, task *models.Task) error {
	return t.taskStore.CreateTask(ctx, task)
}

// DeleteTask implements [TaskService].
func (t *taskService) DeleteTask(ctx context.Context, id uuid.UUID) error {
	return t.taskStore.DeleteTask(ctx, id)
}

// GetTask implements [TaskService].
func (t *taskService) GetTask(ctx context.Context, id uuid.UUID) (*models.Task, error) {
	task, err := t.taskStore.GetTask(ctx, id)
	if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrTaskNotFound
	}
	return task, err
}

// GetTasksAssignedToProjectMember implements [TaskService].
func (t *taskService) GetTasksAssignedToProjectMember(ctx context.Context, projectMemberID uuid.UUID) ([]models.TaskAssignee, error) {
	return t.taskStore.GetTasksAssignedToProjectMember(ctx, projectMemberID)
}

// GetTasksForProject implements [TaskService].
func (t *taskService) GetTasksForProject(ctx context.Context, projectID uuid.UUID) ([]models.Task, error) {
	return t.taskStore.GetTasksForProject(ctx, projectID)
}

// MoveTask implements [TaskService].
func (t *taskService) MoveTask(ctx context.Context, id uuid.UUID, pos int) error {
	return t.taskStore.MoveTask(ctx, id, pos)
}

// UnassignTask implements [TaskService].
func (t *taskService) UnassignTask(ctx context.Context, taskID uuid.UUID, projectMemberID uuid.UUID) error {
	return t.taskStore.UnassignTask(ctx, taskID, projectMemberID)
}

// UpdateTask implements [TaskService].
func (t *taskService) UpdateTask(ctx context.Context, id uuid.UUID, fields UpdateTaskFields) (*models.Task, error) {
	return t.taskStore.UpdateTask(ctx, id, taskStore.UpdateTaskFields{
		Title:                   fields.Title,
		Description:             fields.Description,
		Status:                  fields.Status,
		StartDate:               fields.StartDate,
		DueDate:                 fields.DueDate,
		ExpectedDurationMinutes: fields.ExpectedDurationMinutes,
		UpdatedAt:               time.Now(),
	})
}

func NewTaskService(taskStore taskStore.TaskStore) TaskService {
	return &taskService{taskStore}
}
