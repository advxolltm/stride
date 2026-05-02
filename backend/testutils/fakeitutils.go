package testutils

import (
	"backend/models"
	"fmt"
	"math/rand"
	"testing"
	"time"

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

func ChoiceSubset[V any](src []V) []V {
	num := rng.Intn(len(src) + 1)
	return ChoiceN(src, num)
}

func ChoiceSubsetNonEmpty[V any](src []V) []V {
	num := rng.Intn(len(src)) + 1
	return ChoiceN(src, num)
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
	avatarUrl := models.AvatarURLMap{
		Small:    "/media/avatars/fake/300.png",
		Medium:   "/media/avatars/fake/600.png",
		Original: "/media/avatars/fake/original.png",
	}
	return models.User{
		Username:     f.Username(),
		Email:        f.Email(),
		PasswordHash: userPassword(),
		FullName:     &name,
		AvatarURL:    &avatarUrl,
	}
}

func fakeProjectSkill(idx int) models.ProjectSkill {
	return models.ProjectSkill{
		Name:        f.SongName(),
		Description: new(f.SongGenre()),
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

		status := f.RandomString([]string{"todo", "in_progress", "done"})
		var completedAt *time.Time
		if status == "done" {
			completedAt = new(startDate.AddDate(0, 0, f.Day()))
		}

		return models.Task{
			Title:                   f.BookTitle(),
			Description:             &desc,
			Status:                  status,
			StartDate:               &startDate,
			DueDate:                 &dueDate,
			ExpectedDurationMinutes: &expMinutes,
			Position:                idx,
			CompletedAt:             completedAt,
			CreatedBy:               taskCreator.ID,
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

func generateProjectSkills(maxSkills int, projects []models.Project) {
	for pidx := range projects {
		skillsCount := rng.Intn(maxSkills) + 1
		skills := generateNOfType(skillsCount, fakeProjectSkill)
		for sidx := range skills {
			skills[sidx].ProjectID = projects[pidx].ID
		}

		projects[pidx].Skills = skills
	}
}

func SelectRandomUser(t *testing.T, db *gorm.DB) models.User {
	t.Helper()
	return SelectRandomUsers(t, db, 1)[0]
}

func SelectRandomUsers(t *testing.T, db *gorm.DB, count int) []models.User {
	t.Helper()
	users, err := gorm.G[models.User](db).Find(t.Context())
	AssertNoError(err)
	return ChoiceN(users, count)
}

func SelectRandomProjects(t *testing.T, db *gorm.DB, count int) []models.Project {
	t.Helper()
	projects, err := gorm.G[models.Project](db).
		Preload("Creator", nil).
		Preload("Members", nil).
		Preload("Members.User", nil).
		Preload("Skills", nil).
		Preload("Messages", nil).
		Preload("Tasks.TaskSkills", nil).
		Preload("Whiteboards", nil).
		Find(t.Context())
	AssertNoError(err)
	return ChoiceN(projects, count)
}

func SelectRandomProject(t *testing.T, db *gorm.DB) models.Project {
	t.Helper()
	return SelectRandomProjects(t, db, 1)[0]
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

func updateProjects(db *gorm.DB, projects []models.Project) {
	for pidx := range projects {
		_, err := gorm.G[models.Project](db).Updates(ctx, projects[pidx])
		AssertNoError(err)
	}
}

func fillDBWithRandomData(db *gorm.DB) {
	// Define a fixed seed to make tests reproducable
	f.Seed(seed)
	batchsize := 25

	users := GenerateRandomUsers(20)
	AssertNoError(gorm.G[models.User](db).CreateInBatches(ctx, &users, batchsize))

	projects := GenerateRandomProjects(20, users)
	AssertNoError(gorm.G[models.Project](db).CreateInBatches(ctx, &projects, batchsize))

	generateProjectMembers(users, projects)
	generateProjectSkills(10, projects)

	updateProjects(db, projects)

	generateTasksForProject(30, projects)

	updateProjects(db, projects)

	generateProjectTaskSkills(projects)
	generateProjectMemberSkills(projects)
	generateTaskAssignments(projects)

	updateProjects(db, projects)
}

func generateTaskAssignments(projects []models.Project) {
	for pidx := range projects {
		for tidx := range projects[pidx].Tasks {
			assignedMembers := ChoiceSubset(projects[pidx].Members)
			assignees := Map(assignedMembers, func(mem models.ProjectMember) models.TaskAssignee {
				return models.TaskAssignee{
					TaskID:          projects[pidx].Tasks[tidx].ID,
					ProjectMemberID: mem.ID,
					AssignedAt:      f.PastDate(),
				}
			})
			projects[pidx].Tasks[tidx].Assignees = assignees
		}
	}
}

func generateProjectTaskSkills(projects []models.Project) {
	for pidx := range projects {
		for tidx := range projects[pidx].Tasks {
			requiredSkills := ChoiceSubsetNonEmpty(projects[pidx].Skills)
			taskSkills := Map(requiredSkills, func(ps models.ProjectSkill) models.TaskSkill {
				return models.TaskSkill{
					TaskID:         projects[pidx].Tasks[tidx].ID,
					ProjectSkillID: ps.ID,
				}
			})

			projects[pidx].Tasks[tidx].TaskSkills = taskSkills
		}
	}
}

func generateProjectMemberSkills(projects []models.Project) {
	for pidx := range projects {
		for midx := range projects[pidx].Members {
			requiredSkills := ChoiceSubsetNonEmpty(projects[pidx].Skills)
			userSkills := Map(requiredSkills, func(ps models.ProjectSkill) models.UserSkill {
				return models.UserSkill{
					UserID:         projects[pidx].Members[midx].ID,
					ProjectSkillID: ps.ID,
				}
			})

			if len(projects[pidx].Members[midx].User.UserSkills) == 0 {
				projects[pidx].Members[midx].User.UserSkills = userSkills
			} else {
				projects[pidx].Members[midx].User.UserSkills = append(projects[pidx].Members[midx].User.UserSkills, userSkills...)
			}
		}
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
