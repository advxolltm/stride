package main

import (
	"backend/db"
	"backend/models"
	"backend/testutils"
	"fmt"
	"log"

	"gorm.io/gorm"
)

func main() {
	fmt.Println("Starting demo data generation...")

	dbConn, err := db.InitGORMDB(db.PostgresDSNFromEnv())
	if err != nil {
		log.Fatal(err)
	}

	testutils.SeedDB(dbConn)

	seedSkillScenario(dbConn)

	seedStrategyScenario(dbConn)

	fmt.Println("Demo data generated successfully!")
}

func seedSkillScenario(dbConn *gorm.DB) {
	frontendUser := models.User{Username: "Alice", Email: "alice@demo.com", PasswordHash: "hashedpwd", IsSuperuser: false}
	backendUser := models.User{Username: "Bob", Email: "bob@demo.com", PasswordHash: "hashedpwd", IsSuperuser: false}
	dbConn.Create(&frontendUser)
	dbConn.Create(&backendUser)

	reactSkill := models.ProjectSkill{Name: "React"}
	goSkill := models.ProjectSkill{Name: "Golang"}

	project := models.Project{Name: "Skills Demo Project", Slug: "skills-demo", Status: "active", Creator: &frontendUser}
	dbConn.Create(&project)

	dbConn.Create(&models.ProjectMember{User: frontendUser, Project: project, Role: "owner", Skills: []models.ProjectSkill{reactSkill}, WorkingHours: 10})
	dbConn.Create(&models.ProjectMember{User: backendUser, Project: project, Role: "member", Skills: []models.ProjectSkill{goSkill}, WorkingHours: 10})

	hours := 5

	dbConn.Create(&models.Task{Title: "Build UI component", Project: project, NeededSkills: []models.ProjectSkill{reactSkill}, Status: "todo", ExpectedDurationHours: &hours})
	dbConn.Create(&models.Task{Title: "Setup Database schema", Project: project, NeededSkills: []models.ProjectSkill{goSkill}, Status: "todo", ExpectedDurationHours: &hours})
}

func seedStrategyScenario(dbConn *gorm.DB) {
	// Scenario where min makespan and divide evenly provide different results
}
