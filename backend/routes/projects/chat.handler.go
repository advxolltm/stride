package projects

import (
	"backend/routes"
	authService "backend/services/auth"
	chatService "backend/services/chat"
	projectService "backend/services/project"
	"errors"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type chatRouteHandler struct {
	chatService    chatService.ChatService
	authService    authService.AuthService
	projectService projectService.ProjectService
	rdb            *redis.Client
}

func newChatRouteHandler(chatService chatService.ChatService, authService authService.AuthService, projectService projectService.ProjectService, rdb *redis.Client) *chatRouteHandler {
	return &chatRouteHandler{chatService, authService, projectService, rdb}
}

func (h *chatRouteHandler) registerRoutes(api *echo.Group) {
	g := api.Group("/:project-id/chat", h.authService.AuthenticatedMiddleware())
	g.GET("", h.messagesPagedGET)
	g.GET("/count", h.messagesCountGET)
	g.GET("/message/:message-id", h.messageGET)
	g.POST("", h.messagePOST)
	g.PATCH("/message/:message-id", h.messagePATCH)
	g.DELETE("/message/:message-id", h.messageDELETE)
}

func (h *chatRouteHandler) mapServiceError(err error) (int, string) {
	switch {
	case errors.Is(err, projectService.ErrProjectNotFound):
		return http.StatusNotFound, err.Error()
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
		ProjectID     uuid.UUID `param:"project-id"`
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
	return c.JSON(http.StatusOK, messageResp)
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
		slog.Error("messageUPATE: Failed to send ws update", "error", err)
	}

	messageResp := routes.MapMessage(message)
	return c.JSON(http.StatusOK, messageResp)
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

	return c.NoContent(http.StatusOK)
}
