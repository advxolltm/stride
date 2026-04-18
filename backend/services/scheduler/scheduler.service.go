package scheduler

import (
	"time"
	"github.com/google/or-tools/ortools/sat/go/cpmodel"

	cmpb "github.com/google/or-tools/ortools/sat/proto/cpmodel"
)

//SCHEDULER
type skill struct {
	name 	string
}

type user struct {
	name 	string
	skills 	[]skill
}

type task struct {
	name 			string
	startat			time.Time
	dueat			time.Time
	needed_skills	[]skill
}

func scheduleTaskToMembers(users []user, tasks []task, skills []skill) {
	//Add ZERO task to tasks

	model := cpmodel.NewCpModelBuilder()

	tasksDomain := cpmodel.NewDomain(0, len(tasks))


	

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