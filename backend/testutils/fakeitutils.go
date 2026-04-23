package testutils

import (
	"backend/models"
	"fmt"
	"math/rand"
	"testing"

	f "github.com/brianvoe/gofakeit/v7"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var seed int64 = 42
var rng = rand.New(rand.NewSource(seed))

func Choice[V any](src *[]V) V {
	if src == nil {
		panic("choice src is nil")
	}
	idx := rng.Intn(len(*src))
	return (*src)[idx]
}

func WeightedChoice[V any](src *[]V, weights []float32) V {
	var a []any
	for _, v := range *src {
		a = append(a, v)
	}

	res, err := f.Weighted(a, weights)
	if err != nil {
		panic(err)
	}

	return res.(V)
}

func UniqueChoice[V any](src *[]V) V {
	if src == nil {
		panic("unique choice src is nil")
	}
	idx := rng.Intn(len(*src))
	c := (*src)[idx]
	(*src)[idx] = (*src)[len(*src)-1]
	*src = (*src)[:len(*src)-1]
	return c
}

func OptionalChoice[V any](src *[]V) *V {
	takeChoice := rng.Intn(2)
	if takeChoice == 1 {
		c := Choice(src)
		return &c
	} else {
		return nil
	}
}

func ChoiceN[V any](src []V, count int) []V {
	if len(src) < count {
		panic("choiceN count is larger than len(src)")
	}

	srcCopy := make([]V, 0, len(src))
	for _, e := range src {
		srcCopy = append(srcCopy, e)
	}

	res := make([]V, 0, count)
	for range count {
		c := UniqueChoice(&srcCopy)
		res = append(res, c)
	}
	return res
}

func userPassword() string {
	hash, err := bcrypt.GenerateFromPassword([]byte("pwd"), bcrypt.DefaultCost)
	AssertNoError(err)
	return string(hash)
}

func GenerateUserPassword() string {
	pwd := f.Password(true, true, true, true, true, 20)
	hash, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
	AssertNoError(err)
	return string(hash)
}

func generateNOfType[T any](count int, producer func(idx int) T) []T {
	res := make([]T, 0, count)
	for i := range count {
		res = append(res, producer(i))
	}
	return res
}

func fakeUser(idx int) models.User {
	name := f.Name()
	avatarUrl := "todo: set avatar url in fakeUser"
	return models.User{
		Username:     f.Username(),
		Email:        f.Email(),
		PasswordHash: userPassword(),
		FullName:     &name,
		AvatarURL:    &avatarUrl,
	}
}

func fakeProjectWithUsers(users []models.User) func(int) models.Project {
	return func(idx int) models.Project {
		name := fmt.Sprintf("%s-%d", f.ProductName(), idx)
		slug := fmt.Sprintf("%s-%d", f.ProductSuffix(), idx)
		desc := f.ProductDescription()
		owner := Choice(&users)

		return models.Project{
			Name:        name,
			Slug:        slug,
			Description: &desc,
			Creator:     &owner,
			Status:      "active",
		}
	}
}

func fakeTaskWithProjects(projects []models.Project) func(int) models.Task {
	return func(idx int) models.Task {
		desc := f.ProductDescription()
		startDate := f.PastDate()
		dueDate := f.FutureDate()
		expMinutes := f.Minute()

		project := Choice(&projects)
		taskCreator := Choice(&project.Members)
		if taskCreator.ID == uuid.Nil {
			panic("invalid taskCreator in fakeTaskWithProjects")
		}

		return models.Task{
			Title:                   f.BookTitle(),
			Description:             &desc,
			Status:                  "todo: status",
			StartDate:               &startDate,
			DueDate:                 &dueDate,
			ExpectedDurationMinutes: &expMinutes,
			Position:                idx,
			CompletedAt:             nil, // TODO: generate already-completed tasks too
			CreatedBy: 				 taskCreator.ID,
			Creator:                 taskCreator,
			Project:                 project,
		}
	}
}

func GenerateRandomUser() models.User {
	return generateNOfType(1, fakeUser)[0]
}

func GenerateRandomUsers(count int) []models.User {
	return generateNOfType(count, fakeUser)
}

func GenerateRandomProject(users []models.User) models.Project {
	return generateNOfType(1, fakeProjectWithUsers(users))[0]
}

func GenerateRandomProjects(count int, users []models.User) []models.Project {
	return generateNOfType(count, fakeProjectWithUsers(users))
}

func GenerateRandomTask(projects []models.Project) models.Task {
	return generateNOfType(1, fakeTaskWithProjects(projects))[0]
}

func GenerateRandomTasks(count int, projects []models.Project) []models.Task {
	return generateNOfType(count, fakeTaskWithProjects(projects))
}

func SelectRandomUser(t *testing.T, db *gorm.DB) models.User {
	t.Helper()
	users, err := gorm.G[models.User](db).Find(t.Context())
	AssertNoError(err)
	return Choice(&users)
}

func SelectRandomUsers(t *testing.T, db *gorm.DB, count int) []models.User {
	t.Helper()
	users, err := gorm.G[models.User](db).Find(t.Context())
	AssertNoError(err)
	return ChoiceN(users, count)
}

func SelectRandomProject(t *testing.T, db *gorm.DB) models.Project {
	t.Helper()
	projects, err := gorm.G[models.Project](db).
		Preload("Creator", nil).
		Preload("Members", nil).
		Preload("Members.User", nil).
		Preload("Skills", nil).
		Preload("Messages", nil).
		Preload("Tasks", nil).
		Preload("Whiteboards", nil).
		Find(t.Context())
	AssertNoError(err)
	return Choice(&projects)
}

func SelectRandomTask(t *testing.T, db *gorm.DB) models.Task {
	t.Helper()
	tasks, err := gorm.G[models.Task](db).
		Preload("Assignees", nil).
		Find(t.Context())
	AssertNoError(err)
	return Choice(&tasks)
}

func RandomUUID(t *testing.T) uuid.UUID {
	t.Helper()
	id, err := uuid.NewRandom()
	AssertNoError(err)
	return id
}

func generateProjectMembers(users []models.User, projects []models.Project) {
	for pidx := range projects {
		membersCount := rng.Intn(len(users)) + 1
		memberUsers := ChoiceN(users, membersCount-1)
		isOwnerInMembers := false
		members := make([]models.ProjectMember, 0, membersCount)
		for _, memberUser := range memberUsers {
			if memberUser.ID == *projects[pidx].CreatedBy {
				isOwnerInMembers = true
			}
			pm := models.ProjectMember{
				JoinedAt: f.PastDate(),
				User:     memberUser,
				Project:  projects[pidx],
			}

			members = append(members, pm)
		}

		powner := models.ProjectMember{
			JoinedAt: f.PastDate(),
			User:     *projects[pidx].Creator,
			Project:  projects[pidx],
		}
		if !isOwnerInMembers {
			members = append(members, powner)
		}

		projects[pidx].Members = members
	}
}

func Faker() *f.Faker {
	return f.GlobalFaker
}

func fillDBWithRandomData(db *gorm.DB) {
	// Define a fixed seed to make tests reproducable
	f.Seed(seed)
	batchsize := 25

	users := GenerateRandomUsers(20)
	AssertNoError(gorm.G[models.User](db).CreateInBatches(ctx, &users, batchsize))

	projects := GenerateRandomProjects(20, users)
	AssertNoError(gorm.G[models.Project](db).CreateInBatches(ctx, &projects, batchsize))

	for pidx := range projects {
		_, err := gorm.G[models.Project](db).Updates(ctx, projects[pidx])
		AssertNoError(err)
	}

	generateProjectMembers(users, projects)

	for pidx := range projects {
		_, err := gorm.G[models.Project](db).Updates(ctx, projects[pidx])
		AssertNoError(err)
	}

	generateTasksForProject(30, projects)

	for pidx := range projects {
		_, err := gorm.G[models.Project](db).Updates(ctx, projects[pidx])
		AssertNoError(err)
	}
}

func generateTasksForProject(maxTasksPerProject int, projects []models.Project) {
	for pidx := range projects {
		taskCount := rng.Intn(maxTasksPerProject)
		p := []models.Project{
			projects[pidx],
		}
		tasks := GenerateRandomTasks(taskCount, p)
		projects[pidx].Tasks = tasks
	}
}

func assignProjectOwners(projects []models.Project) {
	for pidx := range projects {
		assignProjectOwner(&projects[pidx])
	}
}

func assignProjectOwner(project *models.Project) {
	o := Choice(&project.Members)
	project.Creator = &o.User
}
