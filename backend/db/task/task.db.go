package task

import (
	"backend/db"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type (
	UpdateTaskFields struct {
		Title                 *string     `gorm:"column:title"`
		Description           **string    `gorm:"column:description"`
		Status                *string     `gorm:"column:status"`
		StartDate             **time.Time `gorm:"column:start_date"`
		DueDate               **time.Time `gorm:"column:due_date"`
		ExpectedDurationHours **int       `gorm:"column:expected_duration_hours"`
		UpdatedAt             time.Time   `gorm:"column:updated_at"`
	}

	Assignment struct {
		TaskID          uuid.UUID
		ProjectMemberID uuid.UUID
	}

	TaskStore interface {
		GetTask(ctx context.Context, id uuid.UUID) (*models.Task, error)
		GetTasksForProject(ctx context.Context, projectID uuid.UUID) ([]models.Task, error)
		GetTasksAssignedToProjectMember(ctx context.Context, projectMemberID uuid.UUID) ([]models.TaskAssignee, error)
		CreateTask(ctx context.Context, task *models.Task) error
		UpdateTask(ctx context.Context, id uuid.UUID, fields UpdateTaskFields) (*models.Task, error)
		DeleteTask(ctx context.Context, id uuid.UUID) error
		AssignTask(ctx context.Context, taskID uuid.UUID, projectMemberID uuid.UUID) (*models.TaskAssignee, error)
		UnassignTask(ctx context.Context, taskID uuid.UUID, projectMemberID uuid.UUID) error
		MoveTask(ctx context.Context, id uuid.UUID, pos int) error
		GetTasksInsideInterval(ctx context.Context, projectID uuid.UUID, startTime time.Time, endTime time.Time) ([]models.Task, error)
		AssignTaskBulk(ctx context.Context, assignments []Assignment) ([]models.TaskAssignee, error)
		GetUnassignedTasksForProject(ctx context.Context, projectID uuid.UUID) ([]models.Task, error)
		AddSkill(ctx context.Context, taskID uuid.UUID, skillID uuid.UUID) (*models.ProjectSkill, error)
		RemoveSkill(ctx context.Context, taskID uuid.UUID, skillID uuid.UUID) error
	}

	taskStore struct {
		db *gorm.DB
	}
)

// GetTask implements [TaskStore].
func (t *taskStore) GetTask(ctx context.Context, id uuid.UUID) (*models.Task, error) {
	var task models.Task

	result := t.db.
		WithContext(ctx).
		Preload("NeededSkills").
		Preload("Assignees.ProjectMember.User").
		First(&task, id)
	// result := t.db.WithContext(ctx).Preload("NeededSkills").First(&task, id)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to get task %s: %w", id, result.Error)
	}

	return &task, nil
}

// GetTasksForProject implements [TaskStore].
func (t *taskStore) GetTasksForProject(ctx context.Context, projectID uuid.UUID) ([]models.Task, error) {
	var project models.Project

	result := t.db.
		WithContext(ctx).
		Preload("Tasks.NeededSkills").
		Preload("Tasks.Assignees.ProjectMember.User").
		First(&project, projectID)
	// result := t.db.WithContext(ctx).Preload("Tasks").Preload("Tasks.NeededSkills").First(&project, projectID)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to get tasks for project %s: %w", projectID, result.Error)
	}

	return project.Tasks, nil
}

func (t *taskStore) GetUnassignedTasksForProject(ctx context.Context, projectID uuid.UUID) ([]models.Task, error) {
	var tasks []models.Task
	result := t.db.WithContext(ctx).Joins("LEFT JOIN task_assignees on task_assignees.task_id = tasks.id").Where("task_assignees.id IS NULL AND tasks.project_id = ?", projectID).Preload("NeededSkills").Find(&tasks)

	if result.Error != nil {
		return nil, fmt.Errorf("failed to find unassigned tasks: %w", result.Error)
	}

	return tasks, nil
}

// GetTasksAssignedToProjectMember implements [TaskStore].
func (t *taskStore) GetTasksAssignedToProjectMember(ctx context.Context, projectMemberID uuid.UUID) ([]models.TaskAssignee, error) {
	var projectMember models.ProjectMember

	result := t.db.WithContext(ctx).
		//Preload("TaskAssignees.Task.NeededSkills").
		Preload("TaskAssignees.ProjectMember").
		Preload("TaskAssignees.Task.NeededSkills").
		First(&projectMember, projectMemberID)
	if result.Error != nil {
		// not found is not an error-case
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return []models.TaskAssignee{}, nil
		}

		return nil, fmt.Errorf("failed to get assigned tasks for project member %s: %w", projectMemberID, result.Error)
	}

	return projectMember.TaskAssignees, nil
}

// CreateTask implements [TaskStore].
func (t *taskStore) CreateTask(ctx context.Context, task *models.Task) error {
	// Ensure that the task.ProjectID is set to the ProjectID of the ProjectMember
	var projectMember models.ProjectMember
	result := t.db.WithContext(ctx).First(&projectMember, task.CreatedBy)
	if result.Error != nil {
		return fmt.Errorf("failed to create task: %w", result.Error)
	}
	task.ProjectID = projectMember.ProjectID

	// First create the task (appended at the end), then move it to the appropriate position
	taskPos := task.Position

	projectTasks, err := t.GetTasksForProject(ctx, task.ProjectID)
	if err != nil {
		return err
	}

	task.Position = 0
	if len(projectTasks) > 0 {
		currentMaxPos := slices.MaxFunc(projectTasks, func(t1 models.Task, t2 models.Task) int {
			return t1.Position - t2.Position
		})

		task.Position = currentMaxPos.Position + 1
	}

	err = t.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Create(task)
		if result.Error != nil {
			return result.Error
		}

		if taskPos > -1 {
			dbTmp := t.db
			t.db = tx
			err := t.MoveTask(ctx, task.ID, taskPos)
			if err != nil {
				t.db = dbTmp
				return err
			}
			t.db = dbTmp
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to create task for project %s: %w", task.ProjectID, err)
	}

	return nil
}

// UpdateTask implements [TaskStore].
func (t *taskStore) UpdateTask(ctx context.Context, id uuid.UUID, fields UpdateTaskFields) (*models.Task, error) {
	var task models.Task

	result := t.db.WithContext(ctx).
		Model(&task).
		Clauses(clause.Returning{}).
		Where("id = ?", id).
		Updates(fields)

	if result.Error != nil {
		return nil, fmt.Errorf("failed to update task %s: %w", id, result.Error)
	}

	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	return &task, nil
}

// DeleteTask implements [TaskStore].
func (t *taskStore) DeleteTask(ctx context.Context, id uuid.UUID) error {
	result := t.db.WithContext(ctx).Delete(&models.Task{}, "id = ?", id)

	if result.Error != nil {
		return fmt.Errorf("failed to delete task %s: %w", id, result.Error)
	}

	return nil
}

// AssignTask implements [TaskStore].
func (t *taskStore) AssignTask(ctx context.Context, taskID uuid.UUID, projectMemberID uuid.UUID) (*models.TaskAssignee, error) {
	taskAssignee := models.TaskAssignee{
		TaskID:          taskID,
		ProjectMemberID: projectMemberID,
	}

	result := t.db.WithContext(ctx).Create(&taskAssignee)

	if result.Error != nil {
		var pgErr *pgconn.PgError

		if errors.As(result.Error, &pgErr) && pgErr.Code == db.UniqueConstraintViolationCode {
			return nil, ErrDuplicateTaskAssignment
		}

		return nil, fmt.Errorf("failed to assign task %s to project member %s: %w", taskID, projectMemberID, result.Error)
	}

	result = t.db.WithContext(ctx).
		Preload("ProjectMember.User").
		First(&taskAssignee, "id = ?", taskAssignee.ID)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to load task assignment %s after create: %w", taskAssignee.ID, result.Error)
	}

	return &taskAssignee, nil
}

func (t *taskStore) UnassignTask(ctx context.Context, taskID uuid.UUID, projectMemberID uuid.UUID) error {
	result := t.db.WithContext(ctx).Delete(&models.TaskAssignee{}, "task_id = ? and project_member_id = ?", taskID, projectMemberID)

	if result.Error != nil {
		return fmt.Errorf("failed to unassign task %s from project member %s: %w", taskID, projectMemberID, result.Error)
	}

	return nil
}

// MoveTask implements [TaskStore].
func (t *taskStore) MoveTask(ctx context.Context, id uuid.UUID, pos int) error {
	dbTmp := t.db
	err := t.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		t.db = tx

		task, err := t.GetTask(ctx, id)
		// This is here because otherwise the update duplicates all skills of the Tasks, since get task also has NeededSkills
		task.NeededSkills = nil
		if err != nil {
			return err
		}

		var highestTaskPos int
		result := tx.
			Table("tasks").
			Select("MAX(position)").
			Where("project_id = ?", task.ProjectID).
			Scan(&highestTaskPos)

		if result.Error != nil {
			return result.Error
		}

		if pos < 0 || pos > highestTaskPos {
			return ErrTaskPositionOutOfBounds
		}

		// Make space for the task that wants to move to pos
		if task.Position == pos {
			// nothing to do
			return nil
		} else if pos < task.Position {
			// The task is moved to the left -> make space by moving other tasks to the right
			tx.Model(&models.Task{}).
				Where("project_id = ? and position >= ? and position <= ?", task.ProjectID, pos, task.Position).
				Update("position", gorm.Expr("position + 1"))
		} else {
			// The task is moved to the right -> make space by moving other tasks to the left
			tx.Model(&models.Task{}).
				Where("project_id = ? and position <= ? and position >= ?", task.ProjectID, pos, task.Position).
				Update("position", gorm.Expr("position - 1"))
		}

		// Insert the task into the position
		result = t.db.
			Model(&task).
			Where("id = ?", id).
			Update("position", pos)

		return result.Error
	})

	if err != nil {
		t.db = dbTmp
		return fmt.Errorf("failed to move task %s: %w", id, err)
	}
	t.db = dbTmp
	return nil
}

func (t *taskStore) AddSkill(ctx context.Context, taskID uuid.UUID, skillID uuid.UUID) (*models.ProjectSkill, error) {
	task := models.Task{ID: taskID}
	skill := models.ProjectSkill{ID: skillID}

	err_count := t.db.WithContext(ctx).
		Model(&task).
		Association("NeededSkills").
		Find(&skill)

	if err_count != nil {
		return nil, fmt.Errorf("failed to add skill: %w", err_count)
	}

	if skill.ProjectID != uuid.Nil {
		return nil, ErrSkillAlreadyAssignedToTask
	}

	skill = models.ProjectSkill{ID: skillID}

	err := t.db.WithContext(ctx).
		Model(&task).
		Association("NeededSkills").
		Append(&skill)
	if err != nil {
		fmt.Println("Error adding skill to task:", err)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == db.UniqueConstraintViolationCode {
			return nil, ErrSkillAlreadyAssignedToTask
		}
		return nil, err
	}

	return &skill, nil
}

func (t *taskStore) RemoveSkill(ctx context.Context, taskID uuid.UUID, skillID uuid.UUID) error {
	task := models.Task{ID: taskID}
	skill := models.ProjectSkill{ID: skillID}

	return t.db.WithContext(ctx).
		Model(&task).
		Association("NeededSkills").
		Delete(&skill)
}

func (t *taskStore) GetTasksInsideInterval(ctx context.Context, projectID uuid.UUID, startTime time.Time, endTime time.Time) ([]models.Task, error) {
	var tasks []models.Task
	result := t.db.WithContext(ctx).Distinct().Joins("JOIN task_assignees on task_assignees.task_id = tasks.id").Where("tasks.due_date > ? AND tasks.start_date < ?  AND tasks.project_id = ?", startTime, endTime, projectID).Preload("Assignees").Preload("NeededSkills").Find(&tasks)

	if result.Error != nil {
		return nil, fmt.Errorf("failed to find preassigned tasks")
	}

	return tasks, nil
}

// func (t *taskStore) AssignTaskBulk(ctx context.Context, assignments []Assignment) ([]models.TaskAssignee, error) {
// 	var assigned []models.TaskAssignee
// 	for _, assignment := range assignments {
// 		assigned = append(assigned, models.TaskAssignee{
// 			TaskID:          assignment.TaskID,
// 			ProjectMemberID: assignment.ProjectMemberID,
// 		})
// 	}
// 	err := t.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
// 		result := tx.Create(&assigned)
// 		// uh oh
// 		if result.Error != nil {
// 			var pgErr *pgconn.PgError
// 			if errors.As(result.Error, &pgErr) && pgErr.Code == db.UniqueConstraintViolationCode {
// 				return ErrDuplicateTaskAssignment
// 			}
// 			return fmt.Errorf("failed to bulk assign tasks: %w", result.Error)
// 		}
// 		// commit
// 		return nil
// 	})

// 	if err != nil {
// 		return nil, err
// 	}
// 	return assigned, nil
// }

func (t *taskStore) AssignTaskBulk(ctx context.Context, assignments []Assignment) ([]models.TaskAssignee, error) {
	if len(assignments) == 0 {
		return []models.TaskAssignee{}, nil
	}
	var assigned []models.TaskAssignee
	var taskIDs []uuid.UUID
	taskIDMap := make(map[uuid.UUID]bool)
	for _, assignment := range assignments {
		assigned = append(assigned, models.TaskAssignee{
			TaskID:          assignment.TaskID,
			ProjectMemberID: assignment.ProjectMemberID,
		})
		if !taskIDMap[assignment.TaskID] {
			taskIDs = append(taskIDs, assignment.TaskID)
			taskIDMap[assignment.TaskID] = true
		}
	}
	err := t.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("task_id IN ?", taskIDs).Delete(&models.TaskAssignee{}).Error; err != nil {
			return fmt.Errorf("failed to clear old assignments: %w", err)
		}
		result := tx.Create(&assigned)
		if result.Error != nil {
			var pgErr *pgconn.PgError
			if errors.As(result.Error, &pgErr) && pgErr.Code == db.UniqueConstraintViolationCode {
				return ErrDuplicateTaskAssignment
			}
			return fmt.Errorf("failed to bulk assign tasks: %w", result.Error)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return assigned, nil
}

func NewTaskStore(db *gorm.DB) TaskStore {
	return &taskStore{db}
}
