package scheduler

import (
	"backend/models"
	projectService "backend/services/project"
	taskService "backend/services/task"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
)

type SchedProjMem struct {
	Identifier   uuid.UUID    `json:"identifier"`
	Skills       []SchedSkill `json:"skills"`
	WorkingHours int          `json:"weekly_hours"` // Python expects weekly_hours!
	Name         string       `json:"name"`
}

type SchedSkill struct {
	Identifier uuid.UUID `json:"identifier"`
	Name       string    `json:"name"`
}

type SchedTask struct {
	Identifier    uuid.UUID    `json:"identifier"`
	Name          string       `json:"name"`
	StartAt       time.Time    `json:"start_at"`
	DueAt         time.Time    `json:"due_at"`
	ExpectedHours int          `json:"expected_hours"`
	NeededSkills  []SchedSkill `json:"needed_skills"`
}

type Settings struct {
	OptimizationGoals []string `json:"optimization_goals"`
	TimeoutSeconds    *int     `json:"timeout_seconds,omitempty"`
}

type SchedulingRequest struct {
	TaskIDs []uuid.UUID
	UserIDs []uuid.UUID // This reqires the model.User ID, not ProjectMember ID
	ProjID  uuid.UUID
}

type Assignment struct {
	UserID uuid.UUID `json:"user_id"`
	TaskID uuid.UUID `json:"task_id"`
}

type ReturnStruct struct {
	NewAssignments     []Assignment `json:"new_assignments"`
	ChangedAssignments []Assignment `json:"changed_assignments"`
}

type InputPayload struct {
	Users       []SchedProjMem `json:"users"`
	Tasks       []SchedTask    `json:"tasks"`
	Assignments []Assignment   `json:"assignments"`
	Settings    Settings       `json:"settings"`
}

func Map[T any, V any](input []T, f func(T) V) []V {
	result := make([]V, len(input))
	for i, v := range input {
		result[i] = f(v)
	}
	return result
}

func mapToSchedProjMem(mem models.ProjectMember) SchedProjMem {
	return SchedProjMem{
		Identifier:   mem.ID,
		Skills:       Map(mem.Skills, mapToSchedSkill),
		WorkingHours: mem.WorkingHours,
		Name:         mem.User.Username,
	}
}

func mapToSchedSkill(skill models.ProjectSkill) SchedSkill {
	return SchedSkill{
		Identifier: skill.ID,
		Name:       skill.Name,
	}
}

func mapToSchedTask(task models.Task, startDate time.Time, endDate time.Time) SchedTask {
	expHours := 0
	if task.ExpectedDurationHours != nil {
		expHours = *task.ExpectedDurationHours
	}
	if task.StartDate == nil {
		task.StartDate = &startDate
	}
	if task.DueDate == nil {
		task.DueDate = &endDate
	}

	return SchedTask{
		Identifier:    task.ID,
		StartAt:       *task.StartDate,
		DueAt:         *task.DueDate,
		ExpectedHours: expHours,
		NeededSkills:  Map(task.NeededSkills, mapToSchedSkill),
	}
}

type (
	SchedulerService interface {
		ScheduleProject(c context.Context, projID uuid.UUID, settings Settings) (*ReturnStruct, error)
		ScheduleTasksToUsers(c context.Context, req SchedulingRequest, settings Settings) (*ReturnStruct, error)
	}
	schedulerService struct {
		taskService    taskService.TaskService
		projectService projectService.ProjectService
	}
)

func StartOfWeek(t time.Time) time.Time {
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	daysToSubtract := weekday - 1
	return time.Date(
		t.Year(), t.Month(), t.Day()-daysToSubtract,
		0, 0, 0, 0,
		t.Location(),
	)
}

func EndOfWeek(t time.Time) time.Time {
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	daysToAdd := 7 - weekday
	return time.Date(
		t.Year(), t.Month(), t.Day()+daysToAdd,
		0, 0, 0, 0,
		t.Location(),
	)
}

func NewSchedulerService(tServe taskService.TaskService, pServe projectService.ProjectService) SchedulerService {
	return &schedulerService{tServe, pServe}
}

func filterSchedulableMembers(
	members []models.ProjectMember,
) ([]models.ProjectMember, error) {
	var schedulableMembers []models.ProjectMember

	for _, member := range members {
		if member.WorkingHours > 0 {
			schedulableMembers = append(schedulableMembers, member)
		}
	}

	if len(schedulableMembers) > 0 {
		return schedulableMembers, nil
	}

	return nil, fmt.Errorf(
		"no selected members have working hours greater than 0, so there is nobody the scheduler can assign tasks to",
	)
}

func (s schedulerService) ScheduleTasksToUsers(c context.Context, req SchedulingRequest, settings Settings) (*ReturnStruct, error) {
	// check if there is anything to schedule
	if len(req.TaskIDs) == 0 || len(req.UserIDs) == 0 {
		return &ReturnStruct{
			NewAssignments:     []Assignment{},
			ChangedAssignments: []Assignment{},
		}, nil
	}

	var raw_users []models.ProjectMember
	var raw_tasks []models.Task

	member_user_map := make(map[uuid.UUID]uuid.UUID)

	// The request comes in with Task IDs and global User IDs
	// The User IDs get converted to ProjectMember IDs for the scheduler here, since tasks work with those

	for _, userid := range req.UserIDs {
		user, err_u := s.projectService.GetProjectMember(c, req.ProjID, userid)
		if err_u != nil {
			//TODO: Return error that shows that some project member was not found
			return nil, err_u
		}
		if user.WorkingHours == 0 {
			continue
		}
		raw_users = append(raw_users, *user)
		//The scheduler works with ProjectMember IDs because the tasks use Projectmember IDs, but the frontend works with UserIDs
		// So here we are...
		member_user_map[user.ID] = userid
	}

	schedulableUsers, err := filterSchedulableMembers(raw_users)
	if err != nil {
		return nil, err
	}

	var minStart time.Time
	var maxEnd time.Time

	for _, taskid := range req.TaskIDs {
		task, err_t := s.taskService.GetTask(c, taskid)
		if err_t != nil {
			// give error that a specified Task was not found
			return nil, err_t
		}
		if task.ProjectID != req.ProjID {
			return nil, fmt.Errorf("%s", "the tasks all have to belong to the specified project.")
		}
		if task.Status != "done" {
			raw_tasks = append(raw_tasks, *task)
		} //  can be "todo" "in_progress" or "done"

		// Find the boundaries of the task to be scheduled
		if task.DueDate == nil && task.StartDate == nil {
			//return nil, fmt.Errorf("%s", "some tasks are missing a start/due date.")
		} else {
			if maxEnd.IsZero() && task.DueDate != nil {
				maxEnd = *task.DueDate
			}
			if minStart.IsZero() && task.StartDate != nil {
				minStart = *task.StartDate
			}
			if task.DueDate != nil && task.DueDate.After(maxEnd) {
				maxEnd = *task.DueDate
			}
			if task.StartDate != nil && task.StartDate.Before(minStart) {
				minStart = *task.StartDate
			}
		}
	}

	if minStart.IsZero() {
		return nil, fmt.Errorf("%s", "at least one task needs to have a start date for the scheduler to work.")
	}
	if maxEnd.IsZero() {
		return nil, fmt.Errorf("%s", "at least one task needs to have a due date for the scheduler to work.")
	}

	relevantTasks, err_t := s.taskService.GetTasksInsideInterval(c, req.ProjID, StartOfWeek(minStart), EndOfWeek(maxEnd))
	if err_t != nil {
		return nil, fmt.Errorf("%s", "could not fetch relevant existing tasks for the schedule.")
	}

	var old_assignments []Assignment
	for _, task := range relevantTasks {
		if len(task.Assignees) > 0 && task.Status != "done" {
			old_assignments = append(old_assignments, Assignment{
				TaskID: task.ID,
				UserID: task.Assignees[0].ProjectMemberID,
			})
		}
	}
	for _, task := range raw_tasks {
		if len(task.Assignees) > 0 {
			old_assignments = append(old_assignments, Assignment{
				TaskID: task.ID,
				UserID: task.Assignees[0].ProjectMemberID,
			})
		}
	}

	if old_assignments == nil {
		old_assignments = []Assignment{}
	}

	// Add all the tasks that are relevant for the scheduler but not in the task list to the list
	uniqueTasksMap := make(map[uuid.UUID]models.Task)
	for _, task := range raw_tasks {
		uniqueTasksMap[task.ID] = task
	}
	for _, task := range relevantTasks {
		if task.Status != "done" {
			uniqueTasksMap[task.ID] = task
		}
	}
	var final_tasks []models.Task
	for _, task := range uniqueTasksMap {
		final_tasks = append(final_tasks, task)
	}

	users := Map(schedulableUsers, mapToSchedProjMem)
	tasks := Map(final_tasks, func(mod models.Task) SchedTask { return mapToSchedTask(mod, minStart, maxEnd) })

	// The scheduler returns an assignment of ProjectMemberIDs to TaskIDs, matches your Haskell logic perfectly
	assignments, err := sendToScheduler(users, tasks, old_assignments, settings)
	if err != nil {
		return nil, err
	}

	var new_assignments []Assignment
	var changed_assignments []Assignment

	old_map := make(map[uuid.UUID]uuid.UUID)
	for _, task := range old_assignments {
		old_map[task.TaskID] = task.UserID
	}

	// Split into new assignments and changed assignments of old ones
	// Swap the ProjectMemberIDs for User IDs when returning the assignments
	// for _, ass := range assignments {
	// 	mappedUserID, ok := member_user_map[ass.UserID]
	// 	if !ok || mappedUserID == uuid.Nil {
	// 		return nil, fmt.Errorf(
	// 			"scheduler returned assignment for unknown project member %s on task %s",
	// 			ass.UserID,
	// 			ass.TaskID,
	// 		)
	// 	}
	// 	if _, ok := old_map[ass.TaskID]; ok && old_map[ass.TaskID] != ass.UserID {
	// 		changed_assignments = append(changed_assignments, Assignment{
	// 			UserID: mappedUserID,
	// 			TaskID: ass.TaskID,
	// 		})
	// 	}
	// 	if _, ok := old_map[ass.TaskID]; !ok {
	// 		new_assignments = append(new_assignments, Assignment{
	// 			UserID: mappedUserID,
	// 			TaskID: ass.TaskID,
	// 		})
	// 	}
	// }

	for _, ass := range assignments {
		mappedUserID, ok := member_user_map[ass.UserID]
		if !ok || mappedUserID == uuid.Nil {
			return nil, fmt.Errorf("unknown project member %s", ass.UserID)
		}

		oldUser, exists := old_map[ass.TaskID]

		fmt.Printf("\n--- Evaluating Task: %s ---\n", ass.TaskID)
		fmt.Printf("Exists in old_map? %v\n", exists)

		if !exists {
			fmt.Printf("Verdict: NEW ASSIGNMENT\n")
			new_assignments = append(new_assignments, Assignment{
				UserID: mappedUserID,
				TaskID: ass.TaskID,
			})
		} else {
			fmt.Printf("Old User (ProjectMemberID): %s\n", oldUser)
			fmt.Printf("New User (ProjectMemberID): %s\n", ass.UserID)

			if oldUser != ass.UserID {
				fmt.Printf("Verdict: CHANGED ASSIGNMENT\n")
				changed_assignments = append(changed_assignments, Assignment{
					UserID: mappedUserID,
					TaskID: ass.TaskID,
				})
			} else {
				fmt.Printf("Verdict: UNCHANGED (Ignored)\n")
			}
		}
	}

	fmt.Printf("\nFINAL TALLY - New: %d | Changed: %d\n", len(new_assignments), len(changed_assignments))

	fmt.Printf("NEW: %s, CHANGE: %s, MAP: %s", new_assignments, changed_assignments, old_map)

	return &ReturnStruct{
		NewAssignments:     new_assignments,
		ChangedAssignments: changed_assignments,
	}, nil
}

func (s schedulerService) ScheduleProject(c context.Context, projID uuid.UUID, settings Settings) (*ReturnStruct, error) {
	raw_tasks, err_t := s.taskService.GetUnassignedTasksForProject(c, projID)
	if err_t != nil {
		return nil, err_t
	}
	proj, err_p := s.projectService.GetProject(c, projID)
	if err_p != nil {
		return nil, err_p
	}

	// pass the IDs of the unassigned tasks and UserIDs of all members to the schedule func
	taskIDs := Map(raw_tasks, func(t models.Task) uuid.UUID { return t.ID })
	userIDs := Map(proj.Members, func(m models.ProjectMember) uuid.UUID { return m.UserID })

	return s.ScheduleTasksToUsers(c, SchedulingRequest{
		TaskIDs: taskIDs,
		UserIDs: userIDs,
		ProjID:  projID,
	}, settings)
}

func sendToScheduler(users []SchedProjMem, tasks []SchedTask, old_assignments []Assignment, settings Settings) ([]Assignment, error) {
	host := os.Getenv("SCHEDULER_HOST")
	if host == "" {
		host = "scheduleserver" // Fallback default
	}

	port := os.Getenv("SCHEDULER_PORT")
	if port == "" {
		port = "7270"
	}

	schedulerURL := fmt.Sprintf("http://%s:%s/", host, port)

	inPayload := InputPayload{
		Users:       users,
		Tasks:       tasks,
		Assignments: old_assignments,
		Settings:    settings,
	}
	body, err := json.Marshal(inPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal scheduler input payload: %w", err)
	}
	req, err := http.NewRequest("POST", schedulerURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request for scheduler: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request to scheduler: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s: %s", "InternalServerError", resp.Status)
	}
	var assignments []Assignment
	content, read_err := io.ReadAll(resp.Body)
	if read_err != nil {
		return nil, fmt.Errorf("failed to read scheduler response: %w", read_err)
	}
	if err := json.Unmarshal(content, &assignments); err != nil {
		return nil, fmt.Errorf("failed to parse scheduler response: %w", err)
	}
	err = resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close scheduler response body: %w", err)
	}
	return assignments, nil
}
