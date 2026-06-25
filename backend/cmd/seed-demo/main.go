package main

import (
	mainDB "backend/db"
	userDB "backend/db/user"
	"backend/models"
	userService "backend/services/user"
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	f "backend/testutils"
	fu "github.com/brianvoe/gofakeit/v7"
)

// Create some test data from CLI
//
// Example inside Docker:
//
//	docker compose -f compose.dev.yml exec backserver go run ./cmd/seed-demo
func main() {
	fmt.Println("Starting demo data generation...")

	dbConn, err := mainDB.InitGORMDB(mainDB.PostgresDSNFromEnv())
	if err != nil {
		log.Fatal(err)
	}

	store := userDB.NewUserStore(dbConn)
	service := userService.NewUserService(store)

	//testutils.SeedDB(dbConn)
	// for deterministic setup
	// but different from generic db setup, since this would otherwise just fill with the exact same data
	fu.Seed(1337)

	seedSkillScenario(dbConn, service)

	seedStrategyScenario(dbConn, service)

	seedLargeScenario(dbConn, service)

	fmt.Println("Demo data generated successfully!")
}

func seedSkillScenario(dbConn *gorm.DB, service userService.UserService) {
	//frontendUser := models.User{Username: "Alice", Email: "alice@demo.com", PasswordHash: "hashedpwd", IsSuperuser: false}
	//backendUser := models.User{Username: "Bob", Email: "bob@demo.com", PasswordHash: "hashedpwd", IsSuperuser: false}
	//dbConn.Create(&frontendUser)
	//dbConn.Create(&backendUser)

	frontendUser, err := service.CreateUser(context.Background(), "Alice-SkillData", "alice@demo.com", "Password1!")
	if err != nil {
		fmt.Println(fmt.Errorf("%s", err.Error()))
	}
	backendUser, err := service.CreateUser(context.Background(), "Bob-SkillData", "bob@demo.com", "Password1!")
	if err != nil {
		fmt.Println(fmt.Errorf("%s", err.Error()))
	}

	project := models.Project{Name: "Skills Demo Project", Slug: "skills-demo", Status: "active", Creator: frontendUser}
	dbConn.Create(&project)

	reactSkill := models.ProjectSkill{Name: "React", ProjectID: project.ID}
	goSkill := models.ProjectSkill{Name: "Golang", ProjectID: project.ID}

	dbConn.Create(&reactSkill)
	dbConn.Create(&goSkill)

	frontMember := models.ProjectMember{User: *frontendUser, Project: project, Role: "owner", Skills: []models.ProjectSkill{reactSkill}, WorkingHours: 10}
	backMember := models.ProjectMember{User: *backendUser, Project: project, Role: "member", Skills: []models.ProjectSkill{goSkill}, WorkingHours: 10}

	dbConn.Create(&frontMember)
	dbConn.Create(&backMember)

	hours := 5

	// No dates being set would also work for showing off the imputing functionality and how it automatically imputes the most loose bound on tasks that have no bounds set
	// Swap around and add both skills to one to show that assignments are made accordingly / not at all when not possible

	dbConn.Create(&models.Task{Title: "Build UI component", Project: project, NeededSkills: []models.ProjectSkill{reactSkill}, Status: "todo", ExpectedDurationHours: &hours, CreatedBy: frontMember.ID})
	dbConn.Create(&models.Task{Title: "Setup Database schema", Project: project, NeededSkills: []models.ProjectSkill{goSkill}, Status: "todo", ExpectedDurationHours: &hours, CreatedBy: backMember.ID})
}

func seedStrategyScenario(dbConn *gorm.DB, service userService.UserService) {
	// Scenario where min makespan and divide evenly provide different results
	fastUser, err := service.CreateUser(context.Background(), "James-SkillData", "james@demo.com", "Password1!")
	if err != nil {
		fmt.Println(fmt.Errorf("%s", err.Error()))
	}
	SlowUser, err := service.CreateUser(context.Background(), "Jane-SkillData", "jane@demo.com", "Password1!")
	if err != nil {
		fmt.Println(fmt.Errorf("%s", err.Error()))
	}

	project := models.Project{Name: "Strategy Demo Project", Slug: "strat-demo", Status: "active", Creator: fastUser}
	dbConn.Create(&project)

	reactSkill := models.ProjectSkill{Name: "React", ProjectID: project.ID}
	goSkill := models.ProjectSkill{Name: "Golang", ProjectID: project.ID}

	dbConn.Create(&reactSkill)
	dbConn.Create(&goSkill)

	// As part of the presentation we can then change the weekly hours of Jane to 10 and shows that now it gives both tasks to James because his load is just 1.0 with all tasks
	// making for a 1.0 maximum delta, while Jane would have a 2.0 workload with the task and james having 0.333333 making for a 1.6666666666666 delta which is less evenly distributed

	// The logic behind this model: If the scheduler gave one task to each person: James would be done in less than 1.5 days while Jane would have to work for a full 2 Weeks
	// If both tasks are given to James - Jane is done immediately, James only has to work for one full week, which is less unfair in our model because there is a smaller working time delta

	fastMember := models.ProjectMember{User: *fastUser, Project: project, Role: "owner", WorkingHours: 30, Skills: []models.ProjectSkill{reactSkill, goSkill}}
	slowMember := models.ProjectMember{User: *SlowUser, Project: project, Role: "member", WorkingHours: 18, Skills: []models.ProjectSkill{reactSkill}}

	dbConn.Create(&fastMember)
	dbConn.Create(&slowMember)

	hoursBeeg := 20
	hoursSmol := 10

	now := time.Date(2026, 6, 22, 0, 0, 0, 0, time.Local)
	oneWeekLater := now.AddDate(0, 0, 5)
	twoWeeksLater := now.AddDate(0, 0, 12)

	dbConn.Create(&models.Task{Title: "Build UI component", Project: project, Status: "todo", ExpectedDurationHours: &hoursBeeg, CreatedBy: fastMember.ID, StartDate: &now, DueDate: &twoWeeksLater, NeededSkills: []models.ProjectSkill{reactSkill}})
	dbConn.Create(&models.Task{Title: "Setup Database schema", Project: project, Status: "todo", ExpectedDurationHours: &hoursSmol, CreatedBy: slowMember.ID, StartDate: &now, DueDate: &oneWeekLater, NeededSkills: []models.ProjectSkill{goSkill}})
}

func seedLargeScenario(dbConn *gorm.DB, service userService.UserService) {
	ctx := context.Background()
	batchsize := 25

	users := f.GenerateRandomUsers(50)
	f.AssertNoError(gorm.G[models.User](dbConn).CreateInBatches(ctx, &users, batchsize))

	project := f.GenerateRandomProject(users)
	project.Name = "Everything but the kitchen sink"
	f.AssertNoError(gorm.G[models.Project](dbConn).Create(ctx, &project))
	projects := []models.Project{project}

	f.GenerateNProjectMembers(users, projects)
	f.GenerateNProjectSkills(10, projects)

	f.UpdateProjects(dbConn, projects)

	f.GenerateNTasksForProject(200, projects)

	f.UpdateProjects(dbConn, projects)

	f.GenerateProjectTaskSkills(projects)
	f.GenerateProjectMemberSkills(projects)
	f.GenerateNTaskAssignments(20, projects)

	f.UpdateProjects(dbConn, projects)

	fmt.Println("=== Generated large task-user scheduling scenario ===")
	fmt.Printf("Project: %s\n", project.Name)
	fmt.Printf("Project-Skills:")
	for _, s := range projects[0].Skills {
		fmt.Printf("\n\t> %s", s.Name)
	}
	fmt.Printf("\nUsers:")
	for _, mem := range projects[0].Members[:5] {
		fmt.Printf("\n\t> %s, %s (skill-count: %d, working-hours: %d)", mem.User.Email, "pwd", len(mem.Skills), mem.WorkingHours)
	}
	fmt.Println("\n=============================================")
}
