package main

import (
	mainDB "backend/db"
	userDB "backend/db/user"
	"backend/models"
	userService "backend/services/user"
	"context"
	"fmt"
	"log"

	"gorm.io/gorm"
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

	seedSkillScenario(dbConn, service)

	seedStrategyScenario(dbConn, service)

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

	dbConn.Create(&models.Task{Title: "Build UI component", Project: project, NeededSkills: []models.ProjectSkill{reactSkill}, Status: "todo", ExpectedDurationHours: &hours, CreatedBy: frontMember.ID})
	dbConn.Create(&models.Task{Title: "Setup Database schema", Project: project, NeededSkills: []models.ProjectSkill{goSkill}, Status: "todo", ExpectedDurationHours: &hours, CreatedBy: backMember.ID})
}

func seedStrategyScenario(dbConn *gorm.DB, service userService.UserService) {
	// Scenario where min makespan and divide evenly provide different results
}
