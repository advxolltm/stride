package db_test

import (
	"backend/models"
	"backend/testutils"
	"os"
	"testing"

	"github.com/google/uuid"
)

func TestMain(m *testing.M) {
	testutils.SetupDB()
	os.Exit(m.Run())
}

// allTableNames returns the expected table names from the migration.
func allTableNames() []string {
	return []string{
		"users",
		"projects",
		"project_members",
		"project_skills",
		"messages",
		"tasks",
		"task_assignees",
		"whiteboards",
		"whiteboard_elements",
	}
}

func TestTablesExist(t *testing.T) {
	for _, table := range allTableNames() {
		t.Run(table, func(t *testing.T) {
			var exists bool
			err := testutils.DB.Raw(
				"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = ?)", table,
			).Scan(&exists).Error
			testutils.TAssertNoError(t, err)
			if !exists {
				t.Errorf("expected table %s to exist", table)
			}
		})
	}
}

func TestFakeDataSeeded(t *testing.T) {
	tests := []struct {
		name  string
		count func() int64
	}{
		{"users", countOf[models.User]},
		{"projects", countOf[models.Project]},
		{"project_members", countOf[models.ProjectMember]},
		{"tasks", countOf[models.Task]},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := tt.count()
			if c == 0 {
				t.Errorf("expected seeded %s, got 0 rows", tt.name)
			}
		})
	}
}

func TestUserCRUD(t *testing.T) {
	name := "Test User"
	user := models.User{
		Username:     "migration_test_user",
		Email:        "migration_test@example.com",
		PasswordHash: "hash",
		FullName:     &name,
	}

	t.Run("create", func(t *testing.T) {
		mustCreate(t, &user)
		if user.ID == uuid.Nil {
			t.Fatal("expected generated UUID")
		}
	})

	t.Run("read", func(t *testing.T) {
		var found models.User
		mustFirst(t, &found, user.ID)
		assertEqual(t, "username", user.Username, found.Username)
	})

	t.Run("update", func(t *testing.T) {
		user.Username = "updated_migration_user"
		mustSave(t, &user)
		var found models.User
		mustFirst(t, &found, user.ID)
		assertEqual(t, "username", "updated_migration_user", found.Username)
	})

	t.Run("delete", func(t *testing.T) {
		mustDelete(t, &user)
		assertRowGone(t, "users", user.ID)
	})
}

func TestProjectWithRelations(t *testing.T) {
	owner := createTestUser(t, "proj_rel_owner")

	project := models.Project{
		Name:      "Rel Test Project",
		Slug:      "rel-test-project",
		Status:    "active",
		CreatedBy: &owner.ID,
	}
	mustCreate(t, &project)
	t.Cleanup(func() { testutils.DB.Delete(&project) })

	member := models.ProjectMember{
		UserID:    owner.ID,
		ProjectID: project.ID,
		Role:      "owner",
	}
	mustCreate(t, &member)
	t.Cleanup(func() { testutils.DB.Delete(&member) })

	t.Run("project_member_linked", func(t *testing.T) {
		var found models.ProjectMember
		err := testutils.DB.Preload("User").Preload("Project").First(&found, member.ID).Error
		testutils.TAssertNoError(t, err)
		assertEqual(t, "user_id", owner.ID, found.User.ID)
		assertEqual(t, "project_id", project.ID, found.Project.ID)
	})

	t.Run("project_skill", func(t *testing.T) {
		desc := "Go programming"
		skill := models.ProjectSkill{
			ProjectID:   project.ID,
			Name:        "Go",
			Description: &desc,
		}
		mustCreate(t, &skill)
		t.Cleanup(func() { testutils.DB.Delete(&skill) })

		var found models.ProjectSkill
		mustFirst(t, &found, skill.ID)
		assertEqual(t, "name", "Go", found.Name)
	})
}

func TestTaskAssigneeChain(t *testing.T) {
	owner := createTestUser(t, "task_chain_owner")
	project := createTestProject(t, "Task Chain Project", "task-chain-project")

	member := models.ProjectMember{
		UserID:    owner.ID,
		ProjectID: project.ID,
		Role:      "developer",
	}
	mustCreate(t, &member)
	t.Cleanup(func() { testutils.DB.Delete(&member) })

	task := models.Task{
		ProjectID: project.ID,
		CreatedBy: &owner.ID,
		Title:     "Test Task",
		Status:    "todo",
	}
	mustCreate(t, &task)
	t.Cleanup(func() { testutils.DB.Delete(&task) })

	assignee := models.TaskAssignee{
		TaskID:          task.ID,
		ProjectMemberID: member.ID,
	}
	mustCreate(t, &assignee)
	t.Cleanup(func() { testutils.DB.Delete(&assignee) })

	t.Run("assignee_preload", func(t *testing.T) {
		var found models.TaskAssignee
		err := testutils.DB.Preload("Task").Preload("ProjectMember").First(&found, assignee.ID).Error
		testutils.TAssertNoError(t, err)
		assertEqual(t, "task_id", task.ID, found.Task.ID)
		assertEqual(t, "member_id", member.ID, found.ProjectMember.ID)
	})
}

func TestMessageBelongsToProject(t *testing.T) {
	sender := createTestUser(t, "msg_sender")
	project := createTestProject(t, "Msg Project", "msg-project")

	msg := models.Message{
		SenderID:  &sender.ID,
		ProjectID: project.ID,
		Content:   "hello world",
	}
	mustCreate(t, &msg)
	t.Cleanup(func() { testutils.DB.Delete(&msg) })

	var found models.Message
	err := testutils.DB.Preload("Sender").Preload("Project").First(&found, msg.ID).Error
	testutils.TAssertNoError(t, err)
	assertEqual(t, "content", "hello world", found.Content)
	assertEqual(t, "sender_id", sender.ID, found.Sender.ID)
	assertEqual(t, "project_id", project.ID, found.Project.ID)
}

func TestWhiteboardWithElements(t *testing.T) {
	creator := createTestUser(t, "wb_creator")
	project := createTestProject(t, "WB Project", "wb-project")

	wb := models.Whiteboard{
		ProjectID: project.ID,
	}
	mustCreate(t, &wb)
	t.Cleanup(func() { testutils.DB.Delete(&wb) })

	elem := models.WhiteboardElement{
		WhiteboardID: wb.ID,
		CreatedBy:    &creator.ID,
		ElementType:  "rectangle",
	}
	mustCreate(t, &elem)
	t.Cleanup(func() { testutils.DB.Delete(&elem) })

	var found models.Whiteboard
	err := testutils.DB.Preload("Elements").First(&found, wb.ID).Error
	testutils.TAssertNoError(t, err)
	if len(found.Elements) != 1 {
		t.Fatalf("expected 1 element, got %d", len(found.Elements))
	}
	assertEqual(t, "element_type", "rectangle", found.Elements[0].ElementType)
}

func TestCascadeDeleteProject(t *testing.T) {
	owner := createTestUser(t, "cascade_owner")

	project := models.Project{
		Name:   "Cascade Project",
		Slug:   "cascade-project",
		Status: "active",
	}
	mustCreate(t, &project)

	member := models.ProjectMember{
		UserID:    owner.ID,
		ProjectID: project.ID,
		Role:      "owner",
	}
	mustCreate(t, &member)

	task := models.Task{
		ProjectID: project.ID,
		Title:     "Cascade Task",
		Status:    "todo",
	}
	mustCreate(t, &task)

	testutils.DB.Delete(&project)

	assertRowGone(t, "project_members", member.ID)
	assertRowGone(t, "tasks", task.ID)
}

// --- helpers (DRY) ---

func countOf[T any]() int64 {
	var count int64
	testutils.DB.Model(new(T)).Count(&count)
	return count
}

func createTestUser(t *testing.T, prefix string) models.User {
	t.Helper()
	user := models.User{
		Username:     prefix,
		Email:        prefix + "@example.com",
		PasswordHash: "hash",
	}
	mustCreate(t, &user)
	t.Cleanup(func() { testutils.DB.Delete(&user) })
	return user
}

func createTestProject(t *testing.T, name, slug string) models.Project {
	t.Helper()
	project := models.Project{
		Name:   name,
		Slug:   slug,
		Status: "active",
	}
	mustCreate(t, &project)
	t.Cleanup(func() { testutils.DB.Delete(&project) })
	return project
}

func mustCreate(t *testing.T, value any) {
	t.Helper()
	testutils.TAssertNoError(t, testutils.DB.Create(value).Error)
}

func mustFirst(t *testing.T, dest any, id uuid.UUID) {
	t.Helper()
	testutils.TAssertNoError(t, testutils.DB.First(dest, id).Error)
}

func mustSave(t *testing.T, value any) {
	t.Helper()
	testutils.TAssertNoError(t, testutils.DB.Save(value).Error)
}

func mustDelete(t *testing.T, value any) {
	t.Helper()
	testutils.TAssertNoError(t, testutils.DB.Delete(value).Error)
}

func assertEqual[T comparable](t *testing.T, field string, expected, actual T) {
	t.Helper()
	if expected != actual {
		t.Errorf("%s: expected %v, got %v", field, expected, actual)
	}
}

func assertRowGone(t *testing.T, table string, id uuid.UUID) {
	t.Helper()
	var count int64
	testutils.DB.Table(table).Where("id = ?", id).Count(&count)
	if count != 0 {
		t.Errorf("expected row %s in %s to be cascade-deleted", id, table)
	}
}
