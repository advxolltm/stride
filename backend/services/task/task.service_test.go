package task_test

import (
	taskStore "backend/db/task"
	"backend/models"
	taskService "backend/services/task"
	"backend/testutils"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, true)
}

func newTestTaskService(db *gorm.DB) taskService.TaskService {
	store := taskStore.NewTaskStore(db)
	return taskService.NewTaskService(store)
}

func runTest(t *testing.T, db *gorm.DB, name string, f func(*testing.T, *gorm.DB, taskService.TaskService)) {
	t.Run(name, func(t *testing.T) {
		db.Transaction(func(tx *gorm.DB) error {
			f(t, tx, newTestTaskService(tx))
			return fmt.Errorf("rollback %s", t.Name())
		})
	})
}

func TestTaskStore(t *testing.T) {
	runTest(t, db, "Creating a task", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
		runTest(t, db, "fails if the project member does not exist", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
			project := testutils.SelectRandomProject(t, db)
			task := testutils.GenerateRandomTask([]models.Project{project})
			task.CreatedBy = testutils.RandomUUID(t)
			err := sut.CreateTask(t.Context(), &task)
			testutils.TAssertError(t, err)
		})

		runTest(t, db, "on success", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
			project := testutils.SelectRandomProject(t, db)
			tasksBefore, err := sut.GetTasksForProject(t.Context(), project.ID)
			testutils.TAssertNoError(t, err)

			randomTask := testutils.GenerateRandomTask([]models.Project{project})
			err = sut.CreateTask(t.Context(), &randomTask)
			testutils.TAssertNoError(t, err)

			runTest(t, db, "the task should be assigned to the project and all task positions should be sequential", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
				tasks, err := sut.GetTasksForProject(t.Context(), project.ID)
				testutils.TAssertNoError(t, err)

				if len(tasksBefore)+1 != len(tasks) {
					t.Error("expected task to be created for project but wasn't")
				}

				taskFound := false
				for _, tsk := range tasks {
					if tsk.ID == randomTask.ID {
						taskFound = true
					}
				}

				if !taskFound {
					t.Errorf("expected task to be created for project but wasn't")
				}

				slices.SortFunc(tasks, func(t1, t2 models.Task) int {
					return t1.Position - t2.Position
				})

				for tidx := range tasks {
					if tidx == len(tasks)-1 {
						break
					}

					t1 := tasks[tidx]
					t2 := tasks[tidx+1]
					if t1.Position+1 != t2.Position {
						t.Errorf("expected sequential task position, but got: %+v", tasks)
					}
				}
			})

			runTest(t, db, "a task can be deleted", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
				randomTask := testutils.SelectRandomTask(t, db)
				err := sut.DeleteTask(t.Context(), randomTask.ID)
				testutils.TAssertNoError(t, err)
			})

			runTest(t, db, "assigning a task", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
				runTest(t, db, "on success", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
					project := testutils.SelectRandomProject(t, db)

					// Ensure that project has at least one task
					{
						prepareRandomTask := testutils.GenerateRandomTask([]models.Project{project})
						err = sut.CreateTask(t.Context(), &prepareRandomTask)
						testutils.TAssertNoError(t, err)
					}

					tasks, err := sut.GetTasksForProject(t.Context(), project.ID)
					testutils.TAssertNoError(t, err)

					randomProjectMember := testutils.Choice(&project.Members)
					randomTask := testutils.Choice(&tasks)

					assignee, err := sut.AssignTask(t.Context(), randomTask.ID, randomProjectMember.ID)
					testutils.TAssertNoError(t, err)

					y1, m1, d1 := assignee.AssignedAt.Date()
					y2, m2, d2 := time.Now().Date()

					if y1 != y2 || m1 != m2 || d1 != d2 {
						t.Errorf("assignee.AssignedAt: expected %s, got %s", time.Now(), assignee.AssignedAt)
					}

					runTest(t, db, "fails if the task is already assigned to the project member", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
						_, err := sut.AssignTask(t.Context(), randomTask.ID, randomProjectMember.ID)
						testutils.TAssertError(t, err)
					})

					runTest(t, db, "project member can query their assigned tasks", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
						assignedTasks, err := sut.GetTasksAssignedToProjectMember(t.Context(), randomProjectMember.ID)
						testutils.TAssertNoError(t, err)

						taskFound := false
						for _, assignedTask := range assignedTasks {
							if assignedTask.TaskID == randomTask.ID {
								taskFound = true
							}
						}

						if !taskFound {
							t.Logf("tasks: %+v", assignedTasks)
							t.Errorf("expected assigned task to be assigned to the project member but wasn't")
						}
					})

					runTest(t, db, "can be unassigned", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
						err := sut.UnassignTask(t.Context(), randomTask.ID, randomProjectMember.ID)
						testutils.TAssertNoError(t, err)
					})
				})
			})

			runTest(t, db, "a task should be able to be updated", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
				newTitle := testutils.Faker().BookTitle()
				newDescription := testutils.Faker().ProductDescription()
				var newExpectedDurationMinutes *int

				tsk := testutils.SelectRandomTask(t, db)
				updatedTask, err := sut.UpdateTask(t.Context(), tsk.ID, taskService.UpdateTaskFields{
					Title:       &newTitle,            // changing non-optional title
					Description: new(&newDescription), // changing optional description
					// Status: ..., not changing non-optional status
					// StartDate: ..., not changing optional startdate
					ExpectedDurationMinutes: new(newExpectedDurationMinutes), // setting optional value to nil
				})

				testutils.TAssertNoError(t, err)

				if updatedTask.Title != newTitle {
					t.Errorf("title: expected %s, got %s", newTitle, updatedTask.Title)
				}

				if *updatedTask.Description != newDescription {
					t.Errorf("description: expected %s, got %s", newDescription, *updatedTask.Description)
				}

				if updatedTask.Status != tsk.Status {
					t.Errorf("status: expected %s, got %s", tsk.Status, updatedTask.Status)
				}

				sYear1, sMonth1, sDay1 := updatedTask.StartDate.Date()
				sYear2, sMonth2, sDay2 := tsk.StartDate.Date()
				if sYear1 != sYear2 || sMonth1 != sMonth2 || sDay1 != sDay2 {
					t.Errorf("startDate: expected %s, got %s", tsk.StartDate, *updatedTask.StartDate)
				}

				if updatedTask.ExpectedDurationMinutes != nil {
					t.Errorf("expectedDurationMinutes: expected nil, got: %d", *updatedTask.ExpectedDurationMinutes)
				}
			})

			runTest(t, db, "a task should be able to be moved", func(t *testing.T, db *gorm.DB, sut taskService.TaskService) {
				project := testutils.SelectRandomProject(t, db)
				swap := testutils.ChoiceN(project.Tasks, 2)
				from := swap[0]
				to := swap[1]

				err := sut.MoveTask(t.Context(), from.ID, to.Position)
				testutils.TAssertNoError(t, err)

				newTasks, err := sut.GetTasksForProject(t.Context(), project.ID)
				testutils.TAssertNoError(t, err)

				t.Logf("moving from %d -> to %d", from.Position, to.Position)

				for _, origTask := range project.Tasks {
					idxNewTask := slices.IndexFunc(newTasks, func(t1 models.Task) bool {
						return t1.ID == origTask.ID
					})

					newTask := newTasks[idxNewTask]
					t.Logf("moved %d -> %d", origTask.Position, newTask.Position)
				}

				if from.Position < to.Position {
					for _, origTask := range project.Tasks {
						idxNewTask := slices.IndexFunc(newTasks, func(t1 models.Task) bool {
							return t1.ID == origTask.ID
						})

						newTask := newTasks[idxNewTask]

						if origTask.Position < from.Position || origTask.Position > to.Position {
							if origTask.Position != newTask.Position {
								t.Errorf("task position should not be changed, but was moved from %d to %d", origTask.Position, newTask.Position)
							}
						} else if origTask.Position == from.Position {
							if newTask.Position != to.Position {
								t.Errorf("target task should have been moved to the desired position (%d), got: %d -> %d", to.Position, origTask.Position, newTask.Position)
							}
						} else {
							if origTask.Position != newTask.Position+1 {
								t.Errorf("task should have been moved to the left by one, but got: %d -> %d", origTask.Position, newTask.Position)
							}
						}
					}
				} else {
					for _, origTask := range project.Tasks {
						idxNewTask := slices.IndexFunc(newTasks, func(t1 models.Task) bool {
							return t1.ID == origTask.ID
						})

						newTask := newTasks[idxNewTask]

						if origTask.Position > from.Position || origTask.Position < to.Position {
							if origTask.Position != newTask.Position {
								t.Errorf("task position should not be changed, but was moved from %d to %d", origTask.Position, newTask.Position)
							}
						} else if origTask.Position == from.Position {
							if newTask.Position != to.Position {
								t.Errorf("target task should have been moved to the desired position (%d), got: %d -> %d", to.Position, origTask.Position, newTask.Position)
							}
						} else {
							if origTask.Position != newTask.Position-1 {
								t.Errorf("task should have been moved to the right by one, but got: %d -> %d", origTask.Position, newTask.Position)
							}
						}
					}
				}
			})

		})
	})
}
