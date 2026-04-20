package scheduler

import (
	"fmt"
	"slices"
	"time"

	"github.com/google/or-tools/ortools/sat/go/cpmodel"

	cmpb "github.com/google/or-tools/ortools/sat/proto/cpmodel"
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
	needed_skills []skill
}

func weekday(d time.Time) int {
	wd := d.Weekday()
	if wd == time.Sunday {
		return 6
	}
	return int(wd) - 1
}

func calculateWorkingDays(start time.Time, end time.Time) int {
	//Round to days (for now at least)
	d := 24 * time.Hour
	start.Truncate(d)
	end.Truncate(d)

	startDay = weekday(start)
	endDay = weekday(end)
	fullWeeks = start.AddDate(0, 0, -startDay).Sub(end.AddDate(0, 0, endDay))

	return (fullWeeks * 5) - (min(startDay, 5) + min(endDay, 5))
}

func scheduleTaskToMembers(users []user, tasks []task, skills []skill) {
	//Add ZERO task to tasks

	model := cpmodel.NewCpModelBuilder()

	numMembers := len(users)
	numTasks := len(tasks)
	numSkills := len(skills)

	timeframeEnd := slices.MaxFunc(tasks, func(a, b task) int {
		if b.dueat.After(a.dueat) {
			// a < b
			return -1
		}
		if b.dueat.Before(a.dueat) {
			// a > b
			return 1
		}
		return 0
	})

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

	workingDays := calculateWorkingDays(tasks[timeframeStart].startat, tasks[timeframeEnd].dueat)

	var hoursPerMember [numMembers]int

	for idx, member := range users {
		hoursPerMember[idx] = int(member.weeklyHours * (workingDays / 5))
	}

	assignment := make([][][]cpmodel.BoolVar, numMembers)
	canDo := make([][]cpmodel.BoolVar, numMembers)
	isInTimeScope := make([][][]cpmodel.BoolVar)

	for i = 0; i < numMembers; i++ {
		assignment[i] = make([][]cpmodel.BoolVar, hoursPerMember[i])
		canDo[i] = make([]cpmodel.BoolVar, numTasks)
		for j = 0; j < hoursPerMember[i]; j++ {
			assignment[i][j] = make([]cpmodel.BoolVar, numTasks)
			for k = 0; k < numTasks; k++ {
				name := fmt.Sprintf("U%d_H%d_T%d", users[i].name, j, tasks[k].name)
				assignment[i][j][k] = model.NewBoolVar().WithName(name) // BOOL for assigning a job to a user

				//check only once for job compatibility
				if j == 0 {
					compatibility := cpmodel.NewConstant(1)

					for idx, taskSkill := range tasks[k].needed_skills {
						if !users[i].skills.Contains(taskSkill) {
							compatibility = cpmodel.NewConstant(0)
						}
					}

					canDo[i][k] = compatibility
				}
				model.AddLessOrEqual(assignment[i][j][k], canDo[i][k]) // ONLY Members with required skills can do a job!
			}
		}
	}

	m, err := model.Model()
	if err != nil {
		return fmt.Errorf("failed to instantiate the CP model: %w", err)
	}
	response, err := cpmodel.SolveCpModel(m)
	if err != nil {
		return fmt.Errorf("failed to solve the model: %w", err)
	}

	switch response.GetStatus() {
	case cmpb.CpSolverStatus_OPTIMAL, cmpb.CpSolverStatus_FEASIBLE:
		fmt.Printf("x = %d\n", cpmodel.SolutionIntegerValue(response, x))
		fmt.Printf("y = %d\n", cpmodel.SolutionIntegerValue(response, y))
		fmt.Printf("z = %d\n", cpmodel.SolutionIntegerValue(response, z))
	default:
		fmt.Println("No solution found.")
	}

	return nil
}
