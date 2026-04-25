package db_test

import (
	"backend/testutils"
	"testing"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

var db *gorm.DB
var rdb *redis.Client

func TestMain(m *testing.M) {
	testutils.RunTestMain(m, &db, &rdb, true, false)
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
			err := db.Raw(
				"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = ?)", table,
			).Scan(&exists).Error
			testutils.TAssertNoError(t, err)
			if !exists {
				t.Errorf("expected table %s to exist", table)
			}
		})
	}
}
