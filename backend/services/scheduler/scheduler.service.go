package scheduler

import (
	"fmt"
	"slices"
	"time"

	"github.com/google/or-tools/ortools/sat/go/cpmodel"
)

// SCHEDULER
type skill struct {
	name string
}

type user struct {
	name       string
	skills     []skill
	weekyHours int
}

type task struct {
	name          string
	startat       time.Time
	dueat         time.Time
	expectedHours int
	needed_skills []skill
}

func weekday(d time.Time) int {
	wd := d.Weekday()
	if wd == time.Sunday {
		return 6
	}
	return int(wd) - 1
}

func userHasSkills(user user, task task) bool {
	for _, skill := range task.needed_skills {
		hasSkill := false
		for _, userSkill := range user.skills {
			if skill.name == userSkill.name {
				hasSkill = true
				break
			}
		}
		if !hasSkill {
			return false
		}
	}
	return true
}

func calculateWorkingDays(start time.Time, end time.Time) int {
	//Round to days (for now at least)
	d := 24 * time.Hour
	start.Truncate(d)
	end.Truncate(d)

	startDay := weekday(start)
	endDay := weekday(end)
	fullWeeks := start.AddDate(0, 0, -startDay).Sub(end.AddDate(0, 0, endDay))
	numWeeks := (fullWeeks.Hours() / 24) / 7
	fmt.Println("Num weeks: %d", numWeeks)
	return (int(numWeeks) * 5) - (min(startDay, 5) + min(endDay, 5))
}

func fullWorkingWeeksUntilDate(planningStart time.Time, date time.Time) int {
	diff := date.Sub(planningStart)
	days := int(diff.Hours() / 24)
	fullWeeks := days / 7 // truncate to only count full weeks
	return fullWeeks
}

func scheduleTaskToMembers(users []user, tasks []task, skills []skill) error {
	model := cpmodel.NewCpModelBuilder()

	numMembers := len(users)
	numTasks := len(tasks)

	timeframeStart := slices.MinFunc(tasks, func(a, b task) int {
		if b.startat.After(a.startat) {
			// a < b
			return -1
		}
		if b.startat.Before(a.startat) {
			// a > b
			return 1
		}
		return 0
	})

	//workingDays := calculateWorkingDays(timeframeStart.startat, timeframeEnd.dueat)

	//var jobAssignmentInterval [][]cpmodel.IntervalVar
	var jobAssignmentPresence [][]cpmodel.BoolVar

	for i := range numMembers {
		var memberJobs []cpmodel.IntervalVar
		var memberJobPresences []cpmodel.BoolVar
		for j := range numTasks {
			if userHasSkills(users[i], tasks[j]) {
				// Create the task interval based on the task infos
				fullWorkingWeeksBeforeTask := fullWorkingWeeksUntilDate(timeframeStart.startat, tasks[j].startat)
				fullWorkingWeeksBeforeTaskEnd := fullWorkingWeeksUntilDate(timeframeStart.startat, tasks[j].dueat)
				job := model.NewOptionalIntervalVar(
					model.NewIntVar(fullWorkingWeeksBeforeTask*users[i].weekyHours, fullWorkingWeeksBeforeTaskEnd*users[i].weekyHours+min(8*int(tasks[j].dueat.Weekday()), users[i].weekyHours), fmt.Sprintf("start_%d_%d", i, j)),
					model.NewIntConst(tasks[j].expectedHours),
					model.NewIntVar(fullWorkingWeeksBeforeTask*users[i].weekyHours, fullWorkingWeeksBeforeTaskEnd*users[i].weekyHours+min(8*int(tasks[j].dueat.Weekday()), users[i].weekyHours), fmt.Sprintf("end_%d_%d", i, j)),
					model.NewBoolVar(fmt.Sprintf("present_job_%d_%d", i, j)),
					fmt.Sprintf("job_%d_%d", i, j),
				)
				// presence of task equal to assignment list to get final assignment
				memberJobs = append(memberJobs, job)
				assignmentVar := model.NewBoolVar(fmt.Sprintf("present_%d_%d", i, j))
				memberJobPresences = append(memberJobPresences, assignmentVar)
				model.AddEquality(job.Presence(), assignmentVar)
			} else {
				// if user can't do task, automatic false presence
				assignmentVar := model.NewBoolConst(false)
				memberJobPresences = append(memberJobPresences, assignmentVar)
			}
		}
		if len(memberJobs) > 0 {
			model.AddNoOverlap(memberJobs...)
		}
		jobAssignmentPresence = append(jobAssignmentPresence, memberJobPresences)
	}

	// Each task is assigned to at most one member
	for j := range numTasks {
		var taskPresences []cpmodel.BoolVar
		for i := range numMembers {
			taskPresences = append(taskPresences, jobAssignmentPresence[i][j])
		}
		model.AddAtMostOne(taskPresences...)
	}

	var allAssignments []cpmodel.LinearArgument
	for i := range numMembers {
		for j := range numTasks {
			allAssignments = append(allAssignments, jobAssignmentPresence[i][j])
		}
	}
	model.Maximize(cpmodel.LinearExprSum(allAssignments))

	m, err := model.Model()
	if err != nil {
		return fmt.Errorf("failed to build the model: %w", err)
	}
	response, err := cpmodel.SolveCpModel(m)
	if err != nil {
		return fmt.Errorf("failed to solve the model: %w", err)
	}

	switch response.GetStatus() {
	case cpmodel.CpSolverStatus_OPTIMAL, cpmodel.CpSolverStatus_FEASIBLE:
		fmt.Printf("Feasable solution found!\n")
		for i := range numMembers {
			for j := range numTasks {
				if response.BooleanValue(jobAssignmentPresence[i][j]) {
					fmt.Printf("Assign task %s to member %s\n", tasks[j].name, users[i].name)
				}
			}
		}
		fmt.Printf("Num of tasks assigned: %d", response.GetObjectiveValue())
	default:
		fmt.Printf("No solution found.\n")
	}
	return nil
}
