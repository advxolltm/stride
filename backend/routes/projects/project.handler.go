package projects

import (
	"backend/models"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"backend/routes"
	authService "backend/services/auth"
	notificationService "backend/services/notification"
	projectService "backend/services/project"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type projectRouteHandler struct {
	projectService      projectService.ProjectService
	notificationService notificationService.NotificationService
	authService         authService.AuthService
	rdb                 *redis.Client
}

func newProjectRouteHandler(ps projectService.ProjectService, ns notificationService.NotificationService, as authService.AuthService, rdb *redis.Client) *projectRouteHandler {
	return &projectRouteHandler{projectService: ps, notificationService: ns, authService: as, rdb: rdb}
}

func (h *projectRouteHandler) registerRoutes(g *echo.Group) {
	g.GET("", h.projectsGETHandle)
	g.GET("/:id", h.projectGETHandle)
	g.GET("/:id/members", h.membersGETHandle)
	g.POST("", h.projectPOSTHandle)
	g.POST("/:id/members", h.memberPOSTHandle)
	g.PATCH("/:id", h.projectPATCHHandle)
	g.DELETE("/:id", h.projectDELETEHandle)
	g.DELETE("/:id/members/:userid", h.memberDELETEHandle)
}

// CreateProjectRequest is the request body for creating a project.
type CreateProjectRequest struct {
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
} //	@name	CreateProjectRequest

type updateProjectRequest struct {
	Name        *string `json:"name"`
	Slug        *string `json:"slug"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
} //	@name	UpdateProjectRequest

// AddMemberRequest is the request body for adding a project member.
type AddMemberRequest struct {
	UserId uuid.UUID `json:"userid"`
	Role   string    `json:"role"`
} //	@name	AddMemberRequest

func mapServiceErrorProj(err error) (int, string) {
	switch {
	case errors.Is(err, projectService.ErrProjectNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrNonExistentUser):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrNonExistentMember):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrUserAlreadyMember):
		return http.StatusConflict, err.Error()
	case errors.Is(err, projectService.ErrNonExistentProjectSkill):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrDuplicateSlug):
		return http.StatusConflict, err.Error()
	case errors.Is(err, projectService.ErrProjectNameTooLong):
		return http.StatusBadRequest, err.Error()
	case errors.Is(err, projectService.ErrSkillNameTooLong):
		return http.StatusBadRequest, err.Error()
	case errors.Is(err, projectService.ErrSkillDescriptionTooLong):
		return http.StatusBadRequest, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

// @Summary		Get all projects
// @Description	Get all projects for the authenticated user
// @Tags			projects
// @Produce		json
// @Success		200	{array}		routes.ReturnProj
// @Failure		404	{object}	routes.ErrorResponse	"user not found"
// @Failure		500	{object}	routes.ErrorResponse	"internal server error"
// @Router			/projects [get]
func (h *projectRouteHandler) projectsGETHandle(c *echo.Context) error {
	userid := h.authService.GetClaims(c).UserID

	projects, err := h.projectService.GetAllProjects(c.Request().Context(), userid)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, routes.Map(projects, routes.MapToReturnProj))
}

// @Summary		Get project by ID
// @Description	Get a specific project's details including creator, members, and skills
// @Tags			projects
// @Produce		json
// @Param			id	path		string	true	"Project ID"
// @Success		200	{object}	routes.ReturnProj
// @Failure		400	{object}	routes.ErrorResponse	"invalid project id"
// @Failure		404	{object}	routes.ErrorResponse	"project not found"
// @Failure		500	{object}	routes.ErrorResponse	"internal server error"
// @Router			/projects/{id} [get]
func (h *projectRouteHandler) projectGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID

	p, err := h.projectService.GetProject(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isMember, err := h.projectService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only project members can access this project"})
	}

	return c.JSON(http.StatusOK, routes.MapToReturnProj(*p))
}

// @Summary		Get project members
// @Description	List all members assigned to a project
// @Tags			projects
// @Produce		json
// @Param			id	path		string	true	"Project ID"
// @Success		200	{array}		routes.ReturnMember
// @Failure		400	{object}	routes.ErrorResponse	"invalid project id"
// @Failure		404	{object}	routes.ErrorResponse	"project not found"
// @Failure		500	{object}	routes.ErrorResponse	"internal server error"
// @Router			/projects/{id}/members [get]
func (h *projectRouteHandler) membersGETHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userid := h.authService.GetClaims(c).UserID

	if _, err := h.projectService.GetProject(c.Request().Context(), id); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	isMember, err := h.projectService.IsProjectMember(c.Request().Context(), userid, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, routes.ErrorResponse{Error: err.Error()})
	}
	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only project members can access this project"})
	}

	members, err := h.projectService.GetProjectMembers(c.Request().Context(), id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, routes.Map(members, routes.MapToReturnMember))
}

// @Summary		Create project
// @Description	Create a new project for the authenticated user
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			request	body		CreateProjectRequest	true	"Project data"
// @Success		201		{object}	routes.ReturnProj
// @Failure		400		{object}	routes.ErrorResponse	"invalid request body"
// @Failure		409		{object}	routes.ErrorResponse	"duplicate slug"
// @Failure		500		{object}	routes.ErrorResponse	"internal server error"
// @Router			/projects [post]
func (h *projectRouteHandler) projectPOSTHandle(c *echo.Context) error {
	var req CreateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	userId := h.authService.GetClaims(c).UserID

	p, err := h.projectService.CreateProject(c.Request().Context(), &userId, req.Name, req.Slug, req.Description, req.Status)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, routes.MapToReturnProj(*p))
}

// @Summary		Add members to project
// @Description	Add one or multiple users to a project with specific roles
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			id		path		string				true	"Project ID"
// @Param			request	body		[]AddMemberRequest	true	"List of users and roles"
// @Success		201		{array}		routes.ReturnMember
// @Failure		400		{object}	routes.ErrorResponse	"invalid request body | invalid project id"
// @Failure		401		{object}	routes.ErrorResponse	"only the owner can add members to this project"
// @Failure		404		{object}	routes.ErrorResponse	"user not found | project not found"
// @Failure		409		{object}	routes.ErrorResponse	"user already member"
// @Router			/projects/{id}/members [post]
func (h *projectRouteHandler) memberPOSTHandle(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}
	var req []AddMemberRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectOwner(c.Request().Context(), userId, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only the owner can add members to this project"})
	}

	var projectMembers []projectService.AddMemberRequest
	for _, user := range req {
		projectMembers = append(projectMembers, projectService.AddMemberRequest{
			UserId: user.UserId,
			Role:   user.Role,
		})
	}

	u, err := h.projectService.AddUsersToProject(c.Request().Context(), projectMembers, id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedMembers := routes.Map(u, routes.MapToReturnMember)
	if err := routes.SendWSUpdate(c.Request().Context(), h.rdb, id, routes.ProjectMemberAdd, mappedMembers); err != nil {
		slog.Error("memberPOSTHandle: Failed to send ws update", "error", err)
	}

	h.notifyAddedProjectMembers(c.Request().Context(), id, u)

	return c.JSON(http.StatusCreated, mappedMembers)
}

// @Summary		Update project
// @Description	Change general project data. Must be project owner.
// @Tags			projects
// @Accept			json
// @Produce		json
// @Param			id		path		string					true	"Project ID"
// @Param			request	body		updateProjectRequest	true	"Updated fields"
// @Success		200		{object}	routes.ReturnProj
// @Failure		400		{object}	routes.ErrorResponse	"invalid request body | invalid project id"
// @Failure		401		{object}	routes.ErrorResponse	"only the owner can update this project"
// @Failure		404		{object}	routes.ErrorResponse	"project not found"
// @Failure		409		{object}	routes.ErrorResponse	"duplicate slug"
// @Router			/projects/{id} [patch]
func (h *projectRouteHandler) projectPATCHHandle(c *echo.Context) error {
	ctx := c.Request().Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectOwner(ctx, userId, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only the owner can update this project"})
	}

	var req updateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	existingProject, err := h.projectService.GetProject(ctx, id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	p, err := h.projectService.UpdateProject(ctx, id, projectService.UpdateProjectInput{
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		Status:      req.Status,
	})
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	mappedProject := routes.MapToReturnProj(*p)
	if err := routes.SendWSUpdate(ctx, h.rdb, id, routes.ProjectUpdate, mappedProject); err != nil {
		slog.Error("projectPATCHHandle: Failed to send ws update", "error", err)
	}

	if existingProject.Status != p.Status {
		h.notifyProjectStatusChange(ctx, *p, userId, existingProject.Status)
	}

	return c.JSON(http.StatusOK, mappedProject)
}

// @Summary		Delete project
// @Description	Permanently delete a project
// @Tags			projects
// @Param			id	path	string	true	"Project ID"
// @Success		204	"No Content"
// @Failure		400	{object}	routes.ErrorResponse	"invalid project id"
// @Failure		401	{object}	routes.ErrorResponse	"only the owner can delete this project"
// @Failure		404	{object}	routes.ErrorResponse	"project not found"
// @Failure		500	{object}	routes.ErrorResponse	"internal server error"
// @Router			/projects/{id} [delete]
func (h *projectRouteHandler) projectDELETEHandle(c *echo.Context) error {
	ctx := c.Request().Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectOwner(ctx, userId, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only the owner can delete this project"})
	}

	project, err := h.projectService.GetProject(ctx, id)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if err := h.projectService.DeleteProject(ctx, id); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	type projectDeleteWSUpdate struct {
		ProjectID uuid.UUID `json:"project_id"`
	} // @name ProjectDeleteWSUpdate

	if err := routes.SendWSUpdate(ctx, h.rdb, id, routes.ProjectDelete, projectDeleteWSUpdate{
		ProjectID: id,
	}); err != nil {
		slog.Error("projectDELETEHandle: Failed to send ws update", "error", err)
	}

	h.notifyProjectDeleted(ctx, *project, userId)

	return c.NoContent(http.StatusNoContent)
}

// @Summary		Remove member
// @Description	Remove a specific user from the project members
// @Tags			projects
// @Param			id		path	string	true	"Project ID"
// @Param			userid	path	string	true	"User ID"
// @Success		204		"No Content"
// @Failure		400		{object}	routes.ErrorResponse	"invalid id"
// @Failure		401		{object}	routes.ErrorResponse	"only the project owner can remove members"
// @Failure		404		{object}	routes.ErrorResponse	"project not found | user not found"
// @Router			/projects/{id}/members/{userid} [delete]
func (h *projectRouteHandler) memberDELETEHandle(c *echo.Context) error {
	projid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}
	userid, err := uuid.Parse(c.Param("userid"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid user id"})
	}

	userId := h.authService.GetClaims(c).UserID
	isOwner, err := h.projectService.IsProjectOwner(c.Request().Context(), userId, projid)
	if err != nil {
		return c.JSON(http.StatusNotFound, routes.ErrorResponse{Error: err.Error()})
	}
	if !isOwner {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "only the owner can remove members from this project"})
	}

	p, err := h.projectService.GetProject(c.Request().Context(), projid)
	if err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if err := h.projectService.RemoveUserFromProject(c.Request().Context(), userid, projid); err != nil {
		status, msg := mapServiceErrorProj(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	type projectMemberRemoveWSUpdate struct {
		UserID uuid.UUID `json:"user_id"`
	} // @name ProjectMemberRemoveWSUpdate

	if err := routes.SendWSUpdate(c.Request().Context(), h.rdb, projid, routes.ProjectMemberRemove, projectMemberRemoveWSUpdate{
		UserID: userid,
	}); err != nil {
		slog.Error("memberDELETEHandle: Failed to send ws update", "error", err)
	}

	h.notifyRemovedProjectMember(c.Request().Context(), userid, *p)

	return c.NoContent(http.StatusNoContent)
}

func (h *projectRouteHandler) notifyAddedProjectMembers(ctx context.Context, projectID uuid.UUID, addedMembers []models.ProjectMember) {
	if h.notificationService == nil || len(addedMembers) == 0 {
		return
	}

	p, err := h.projectService.GetProject(ctx, projectID)
	if err != nil {
		slog.Error("memberPOSTHandle: Failed to get project for notification", "error", err)
		return
	}

	userIDs := routes.ProjectMemberUserIDs(addedMembers)
	if len(userIDs) == 0 {
		return
	}

	if err := h.notificationService.SendBulkNotification(
		ctx,
		userIDs,
		"project",
		projectID,
		projectMemberAddedNotificationMessage(*p),
	); err != nil {
		slog.Error("memberPOSTHandle: Failed to send notification", "error", err)
	}
}

func (h *projectRouteHandler) notifyRemovedProjectMember(ctx context.Context, userID uuid.UUID, project models.Project) {
	if h.notificationService == nil || userID == uuid.Nil {
		return
	}

	if err := h.notificationService.SendNotification(
		ctx,
		userID,
		"project",
		project.ID,
		projectMemberRemovedNotificationMessage(project),
	); err != nil {
		slog.Error("memberDELETEHandle: Failed to send notification", "error", err)
	}
}

func (h *projectRouteHandler) notifyProjectStatusChange(
	ctx context.Context,
	project models.Project,
	excludedUserID uuid.UUID,
	previousStatus string,
) {
	if h.notificationService == nil || project.Status == previousStatus {
		return
	}

	if project.Status != "archived" && project.Status != "active" {
		return
	}

	userIDs := routes.ExcludeUserID(
		routes.ProjectMemberUserIDs(project.Members),
		excludedUserID,
	)
	if len(userIDs) == 0 {
		return
	}

	if err := h.notificationService.SendBulkNotification(
		ctx,
		userIDs,
		"project",
		project.ID,
		projectStatusChangedNotificationMessage(project),
	); err != nil {
		slog.Error("projectPATCHHandle: Failed to send notification", "error", err)
	}
}

func (h *projectRouteHandler) notifyProjectDeleted(
	ctx context.Context,
	project models.Project,
	excludedUserID uuid.UUID,
) {
	if h.notificationService == nil {
		return
	}

	userIDs := routes.ExcludeUserID(
		routes.ProjectMemberUserIDs(project.Members),
		excludedUserID,
	)
	if len(userIDs) == 0 {
		return
	}

	if err := h.notificationService.SendBulkNotification(
		ctx,
		userIDs,
		"project",
		project.ID,
		projectDeletedNotificationMessage(project),
	); err != nil {
		slog.Error("projectDELETEHandle: Failed to send notification", "error", err)
	}
}

func projectMemberAddedNotificationMessage(project models.Project) string {
	return fmt.Sprintf("You were added to project: %s", project.Name)
}

func projectMemberRemovedNotificationMessage(project models.Project) string {
	return fmt.Sprintf("You were removed from project: %s", project.Name)
}

func projectArchivedNotificationMessage(project models.Project) string {
	return fmt.Sprintf("Project archived: %s", project.Name)
}

func projectUnarchivedNotificationMessage(project models.Project) string {
	return fmt.Sprintf("Project unarchived: %s", project.Name)
}

func projectStatusChangedNotificationMessage(project models.Project) string {
	if project.Status == "active" {
		return projectUnarchivedNotificationMessage(project)
	}

	return projectArchivedNotificationMessage(project)
}

func projectDeletedNotificationMessage(project models.Project) string {
	return fmt.Sprintf("Project deleted: %s", project.Name)
}
