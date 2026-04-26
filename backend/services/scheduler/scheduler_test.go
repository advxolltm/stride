package scheduler

import (
	"testing"
	"time"
)

func TestScheduler(t *testing.T) {
	now := time.Now()

	goSkill := skill{name: "Go"}
	dbSkill := skill{name: "Database"}

	alice := user{
		name:       "Alice",
		skills:     []skill{goSkill},
		weekyHours: 40,
	}
	bob := user{
		name:       "Bob",
		skills:     []skill{goSkill, dbSkill},
		weekyHours: 40,
	}

	t.Run("Feasible Schedule", func(t *testing.T) {
		// Alice can do task 1, Bob must do task 2 (needs DB)
		tasks := []task{
			{
				name:          "Write API",
				startat:       now,
				dueat:         now.AddDate(0, 0, 7),
				expectedHours: 20,
				needed_skills: []skill{goSkill},
			},
			{
				name:          "Setup DB",
				startat:       now,
				dueat:         now.AddDate(0, 0, 7),
				expectedHours: 15,
				needed_skills: []skill{dbSkill},
			},
		}

		err := scheduleTaskToMembers([]user{alice, bob}, tasks)
		if err != nil {
			t.Fatalf("Expected no error, got: %v", err)
		}
		// Check standard output for "Feasible scheduling solution found!"
	})

	t.Run("Infeasible - Missing Skills", func(t *testing.T) {
		// Neither Alice nor Bob has the "React" skill
		reactSkill := skill{name: "React"}
		tasks := []task{
			{
				name:          "Build Frontend",
				startat:       now,
				dueat:         now.AddDate(0, 0, 7),
				expectedHours: 20,
				needed_skills: []skill{reactSkill},
			},
		}

		err := scheduleTaskToMembers([]user{alice, bob}, tasks)
		if err != nil {
			t.Fatalf("Expected no error, got: %v", err)
		}
		// Check standard output for "No solution found (INFEASIBLE)."
	})

	t.Run("Infeasible - Too much work for one person", func(t *testing.T) {
		// Both require DB, only Bob has DB. But 100 hours is > weekly hours
		tasks := []task{
			{
				name:          "Massive DB Migration",
				startat:       now,
				dueat:         now.AddDate(0, 0, 7),
				expectedHours: 100, // Bob can't do 100 hours in a week
				needed_skills: []skill{dbSkill},
			},
		}

		err := scheduleTaskToMembers([]user{alice, bob}, tasks)
		if err != nil {
			t.Fatalf("Expected no error, got: %v", err)
		}
		// Check standard output for "No solution found (INFEASIBLE)."
	})
}
