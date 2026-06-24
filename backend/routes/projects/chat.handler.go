package projects

import (
	"backend/models"
	"backend/routes"
	authService "backend/services/auth"
	chatService "backend/services/chat"
	notificationService "backend/services/notification"
	projectService "backend/services/project"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type chatRouteHandler struct {
	chatService         chatService.ChatService
	authService         authService.AuthService
	projectService      projectService.ProjectService
	notificationService notificationService.NotificationService
	rdb                 *redis.Client
}

func newChatRouteHandler(chatService chatService.ChatService, authService authService.AuthService, projectService projectService.ProjectService, notificationService notificationService.NotificationService, rdb *redis.Client) *chatRouteHandler {
	return &chatRouteHandler{chatService, authService, projectService, notificationService, rdb}
}

func (h *chatRouteHandler) registerRoutes(api *echo.Group) {
	g := api.Group("/:project-id/chat", h.authService.AuthenticatedMiddleware())
	g.GET("", h.messagesPagedGET)
	g.GET("/count", h.messagesCountGET)
	g.GET("/message/:message-id", h.messageGET)
	g.POST("", h.messagePOST)
	g.PATCH("/message/:message-id", h.messagePATCH)
	g.DELETE("/message/:message-id", h.messageDELETE)
	g.GET("/cursors", h.chatCursorsGET)
	g.PATCH("/cursors/delivered", h.chatCursorDeliveredPATCH)
	g.PATCH("/cursors/read", h.chatCursorReadPATCH)
}

func (h *chatRouteHandler) mapServiceError(err error) (int, string) {
	switch {
	case errors.Is(err, projectService.ErrProjectNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, chatService.ErrMessageNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, projectService.ErrProjectMemberNotFound):
		return http.StatusUnauthorized, "unauthorized"
	default:
		slog.Error("unexpected error in chat route handler", "error", err.Error())
		return http.StatusInternalServerError, "internal server error"
	}
}

// @Summary Gets a range of messages. `createdBefore` and `count` must be set as a query param
// @Tags chat
// @Param project-id path string true "Project ID"
// @Param count query int true "Number of messages to return"
// @Param createdBefore query string true "Find messages created before this timestamp" Format(dateTime)
// @Success 200 {array} Message "messages"
// @Failure 400 {object} ErrorResponse "invalid project id or message count or message createdBefore"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Failure 404 {object} ErrorResponse "project not found"
// @Router /projects/{project-id}/chat [get]
func (h *chatRouteHandler) messagesPagedGET(c *echo.Context) error {
	ctx := c.Request().Context()

	type reqFields struct {
		ProjectID uuid.UUID `param:"project-id"`
		routes.PaginationRequest
	}

	var req reqFields
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	userId := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(ctx, userId, req.ProjectID)

	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	messages, err := h.chatService.GetProjectMessages(ctx, req.ProjectID, req.Page, req.PageSize)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	messagesResp := routes.MapPaginated(messages, routes.MapMessage)
	return c.JSON(http.StatusOK, messagesResp)
}

// @Summary Gets the message count in a chat
// @Tags chat
// @Param project-id path string true "Project ID"
// @Success 200 {array} MessageCount "Number of messages"
// @Failure 400 {object} ErrorResponse "invalid project id"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Failure 404 {object} ErrorResponse "project not found"
// @Router /projects/{project-id}/chat/count [get]
func (h *chatRouteHandler) messagesCountGET(c *echo.Context) error {
	ctx := c.Request().Context()

	type reqFields struct {
		ProjectID uuid.UUID `param:"project-id"`
	}

	var req reqFields
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	userId := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(ctx, userId, req.ProjectID)

	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	count, err := h.chatService.GetMessageCount(ctx, req.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	countResp := routes.MessageCount{
		Count: count,
	}
	return c.JSON(http.StatusOK, countResp)
}

// @Summary Gets a specific message
// @Tags chat
// @Param project-id path string true "Project ID"
// @Param message-id path string true "Message ID"
// @Success 200 {object} Message "Message"
// @Failure 400 {object} ErrorResponse "invalid project id or message id"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Failure 404 {object} ErrorResponse "project not found or message not found"
// @Router /projects/{project-id}/chat/message/{message-id} [get]
func (h *chatRouteHandler) messageGET(c *echo.Context) error {
	ctx := c.Request().Context()

	type reqFields struct {
		ProjectID uuid.UUID `param:"project-id"`
		MessageID uuid.UUID `param:"message-id"`
	}

	var req reqFields
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	userId := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(ctx, userId, req.ProjectID)

	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	message, err := h.chatService.GetMessage(ctx, req.MessageID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	messageResp := routes.MapMessage(message)
	return c.JSON(http.StatusOK, messageResp)
}

type createMessageRequest struct {
	Content string `json:"content" example:"You should play Hollow Knight!"`
}

// @Summary Send a new message in the chat
// @Tags chat
// @Param project-id path string true "Project ID"
// @Param data body createMessageRequest true "Message content"
// @Success 200 {object} Message "Message"
// @Failure 400 {object} ErrorResponse "bad request"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Failure 404 {object} ErrorResponse "project not found"
// @Router /projects/{project-id}/chat [post]
func (h *chatRouteHandler) messagePOST(c *echo.Context) error {
	ctx := c.Request().Context()

	type reqFields struct {
		ProjectID uuid.UUID `param:"project-id"`
		createMessageRequest
	}

	var req reqFields
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	userId := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(ctx, userId, req.ProjectID)

	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	member, err := h.projectService.GetProjectMember(ctx, req.ProjectID, userId)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	message, err := h.chatService.CreateMessage(ctx, req.Content, *member)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if err := routes.SendWSUpdate(ctx, h.rdb, req.ProjectID, routes.ChatMessageCreate, routes.Message{ID: message.ID}); err != nil {
		slog.Error("messageCreate: Failed to send ws update", "error", err)
	}
	messageResp := routes.MapMessage(message)

	defer func() {
		projectMembers, err := h.projectService.GetProjectMembers(ctx, message.ProjectID)
		if err != nil {
			slog.Error("messagePOST: Failed to get project members for notification", "error", err)
			return
		}

		err = h.notificationService.SendBulkNotification(
			ctx,
			routes.ExcludeUserID(routes.ProjectMemberUserIDs(projectMembers), userId),
			"chat",
			req.ProjectID,
			messageCreatedNotification(member.User, message),
		)

		if err != nil {
			slog.Error("taskMovePOST: Failed to send notification", "error", err)
		}
	}()

	return c.JSON(http.StatusOK, messageResp)
}

func messageCreatedNotification(sender models.User, message models.Message) string {
	return fmt.Sprintf("%s: %s", notificationSenderName(sender), message.Content)
}

func notificationSenderName(sender models.User) string {
	if sender.FullName != nil && *sender.FullName != "" {
		return *sender.FullName
	}

	if sender.Username != "" {
		return sender.Username
	}

	return "Unknown user"
}

type updateMessageRequest struct {
	Content string `json:"content" example:"You should play Deltarune!"`
} // @name UpdateMessageRequest

// @Summary Updates a specific message
// @Tags chat
// @Param project-id path string true "Project ID"
// @Param message-id path string true "Message ID"
// @Param data body updateMessageRequest true "Update message data"
// @Success 200 {object} Message "Message"
// @Failure 400 {object} ErrorResponse "invalid project id or message id"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Failure 404 {object} ErrorResponse "project not found or message not found"
// @Router /projects/{project-id}/chat/message/{message-id} [patch]
func (h *chatRouteHandler) messagePATCH(c *echo.Context) error {
	ctx := c.Request().Context()

	type reqFields struct {
		ProjectID uuid.UUID `param:"project-id"`
		MessageID uuid.UUID `param:"message-id"`
		updateMessageRequest
	}

	var req reqFields
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	userId := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(ctx, userId, req.ProjectID)

	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	message, err := h.chatService.UpdateMessage(ctx, req.MessageID, req.Content)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if err := routes.SendWSUpdate(ctx, h.rdb, req.ProjectID, routes.ChatMessageUpdate, routes.Message{ID: req.MessageID}); err != nil {
		slog.Error("messagePATCH: Failed to send ws update", "error", err)
	}
	messageResp := routes.MapMessage(message)

	defer func() {
		member, err := h.projectService.GetProjectMember(ctx, req.ProjectID, userId)
		if err != nil {
			slog.Error("messagePATCH: Failed to get editor for notification", "error", err)
			return
		}

		projectMembers, err := h.projectService.GetProjectMembers(ctx, req.ProjectID)
		if err != nil {
			slog.Error("messagePATCH: Failed to get project members for notification", "error", err)
			return
		}

		err = h.notificationService.SendBulkNotification(
			ctx,
			routes.ExcludeUserID(routes.ProjectMemberUserIDs(projectMembers), userId),
			"chat",
			req.ProjectID,
			messageEditedNotification(member.User, message),
		)

		if err != nil {
			slog.Error("messagePATCH: Failed to send notification", "error", err)
			return
		}
	}()

	return c.JSON(http.StatusOK, messageResp)
}

func messageEditedNotification(sender models.User, message models.Message) string {
	return fmt.Sprintf("%s (edited): %s", notificationSenderName(sender), message.Content)
}

// @Summary Deletes a specific message
// @Tags chat
// @Param project-id path string true "Project ID"
// @Param message-id path string true "Message ID"
// @Success 200
// @Failure 400 {object} ErrorResponse "invalid project id or message id"
// @Failure 401 {object} ErrorResponse "unauthorized"
// @Failure 404 {object} ErrorResponse "project not found or message not found"
// @Router /projects/{project-id}/chat/message/{message-id} [delete]
func (h *chatRouteHandler) messageDELETE(c *echo.Context) error {
	ctx := c.Request().Context()

	type reqFields struct {
		ProjectID uuid.UUID `param:"project-id"`
		MessageID uuid.UUID `param:"message-id"`
	}

	var req reqFields
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	userId := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(ctx, userId, req.ProjectID)

	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	err = h.chatService.DeleteMessage(ctx, req.MessageID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if err := routes.SendWSUpdate(ctx, h.rdb, req.ProjectID, routes.ChatMessageDelete, routes.Message{ID: req.MessageID}); err != nil {
		slog.Error("messageDELETE: Failed to send ws update", "error", err)
	}

	// NOTE: I don't think we should send a notification message when a chat message was deleted...

	return c.NoContent(http.StatusOK)
}

// @Summary Gets chat member cursors
// @Tags chat
// @Param project-id path string true "Project ID"
// @Success 200 {array} routes.ChatMemberCursor "Chat member cursors"
// @Failure 400 {object} routes.ErrorResponse "invalid project id"
// @Failure 401 {object} routes.ErrorResponse "unauthorized"
// @Failure 404 {object} routes.ErrorResponse "project not found"
// @Router /projects/{project-id}/chat/cursors [get]
func (h *chatRouteHandler) chatCursorsGET(c *echo.Context) error {
	ctx := c.Request().Context()

	type reqFields struct {
		ProjectID uuid.UUID `param:"project-id"`
	}

	var req reqFields
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	userID := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(ctx, userID, req.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	cursors, err := h.chatService.GetProjectChatCursors(ctx, req.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, routes.Map(cursors, routes.MapChatMemberCursor))
}

type markCursorRequest struct {
	MessageID uuid.UUID `json:"messageId"`
} // @name MarkChatCursorRequest

// @Summary Marks a chat message as delivered
// @Tags chat
// @Param project-id path string true "Project ID"
// @Param data body markCursorRequest true "Message cursor data"
// @Success 200 {object} routes.ChatMemberCursor "Updated chat member cursor"
// @Failure 400 {object} routes.ErrorResponse "invalid project id or message id"
// @Failure 401 {object} routes.ErrorResponse "unauthorized"
// @Failure 404 {object} routes.ErrorResponse "project not found or message not found"
// @Router /projects/{project-id}/chat/cursors/delivered [patch]
func (h *chatRouteHandler) chatCursorDeliveredPATCH(c *echo.Context) error {
	ctx := c.Request().Context()

	type reqFields struct {
		ProjectID uuid.UUID `param:"project-id"`
		markCursorRequest
	}

	var req reqFields
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	userID := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(ctx, userID, req.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	member, err := h.projectService.GetProjectMember(ctx, req.ProjectID, userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	cursor, err := h.chatService.MarkDelivered(ctx, req.ProjectID, member.ID, req.MessageID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	cursorResp := routes.MapChatMemberCursor(cursor)
	if err := routes.SendWSUpdate(ctx, h.rdb, req.ProjectID, routes.ChatMemberCursorUpdate, cursorResp); err != nil {
		slog.Error("chatCursorDeliveredPATCH: Failed to send ws update", "error", err)
	}

	return c.JSON(http.StatusOK, cursorResp)
}

// @Summary Marks a chat message as read
// @Tags chat
// @Param project-id path string true "Project ID"
// @Param data body markCursorRequest true "Message cursor data"
// @Success 200 {object} routes.ChatMemberCursor "Updated chat member cursor"
// @Failure 400 {object} routes.ErrorResponse "invalid project id or message id"
// @Failure 401 {object} routes.ErrorResponse "unauthorized"
// @Failure 404 {object} routes.ErrorResponse "project not found or message not found"
// @Router /projects/{project-id}/chat/cursors/read [patch]
func (h *chatRouteHandler) chatCursorReadPATCH(c *echo.Context) error {
	ctx := c.Request().Context()

	type reqFields struct {
		ProjectID uuid.UUID `param:"project-id"`
		markCursorRequest
	}

	var req reqFields
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.BadRequestErrResponse(err))
	}

	userID := h.authService.GetClaims(c).UserID
	isMember, err := h.projectService.IsProjectMember(ctx, userID, req.ProjectID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	if !isMember {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: "unauthorized"})
	}

	member, err := h.projectService.GetProjectMember(ctx, req.ProjectID, userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	cursor, err := h.chatService.MarkRead(ctx, req.ProjectID, member.ID, req.MessageID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	cursorResp := routes.MapChatMemberCursor(cursor)
	if err := routes.SendWSUpdate(ctx, h.rdb, req.ProjectID, routes.ChatMemberCursorUpdate, cursorResp); err != nil {
		slog.Error("chatCursorReadPATCH: Failed to send ws update", "error", err)
	}

	return c.JSON(http.StatusOK, cursorResp)
}
