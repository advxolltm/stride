package routes

import (
	"errors"
	"net/http"

	authService "backend/services/auth"
	notificationService "backend/services/notification"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type NotificationResponse struct { //nolint:unused
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	EditType   string    `json:"edit_type"`
	ObjectType string    `json:"object_type"`
	ObjectID   uuid.UUID `json:"object_id"`
	Message    string    `json:"message"`
	Read       bool      `json:"read"`
}

type notificationRouteHandler struct {
	authService         authService.AuthService
	notificationService notificationService.NotificationService
}

type createNotificationRequest struct {
	ObjectType string    `json:"object_type"`
	ObjectID   uuid.UUID `json:"object_id"`
	Message    string    `json:"message"`
}

func NewNotificationRouteHandler(ns notificationService.NotificationService, as authService.AuthService) *notificationRouteHandler {
	return &notificationRouteHandler{
		authService:         as,
		notificationService: ns,
	}
}

func (h notificationRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/notifications", h.authService.AuthenticatedMiddleware())
	g.GET("", h.notificationsGETHandle)
	g.PATCH("/:id/read", h.notificationReadPATCHHandle)
	g.DELETE("/:id", h.notificationDELETEHandle)
}

func (h notificationRouteHandler) mapServiceError(err error) (int, string) {
	switch {
	case errors.Is(err, notificationService.ErrNotificationNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, notificationService.ErrNotificationUserIDRequired),
		errors.Is(err, notificationService.ErrNotificationIDRequired),
		errors.Is(err, notificationService.ErrNotificationObjectTypeRequired),
		errors.Is(err, notificationService.ErrNotificationObjectIDRequired),
		errors.Is(err, notificationService.ErrNotificationMessageRequired):
		return http.StatusBadRequest, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

// GET /notifications
//
//	@Summary	Get notifications for authenticated user
//	@Description	Returns the current notification list for the authenticated user. Repeated stream entries for the same notification are collapsed to the latest state.
//	@Tags		notifications
//	@Success	200	{array}	NotificationResponse	"notifications"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Failure	500	{object}	ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/notifications [get]
func (h notificationRouteHandler) notificationsGETHandle(c *echo.Context) error {
	userID := h.authService.GetClaims(c).UserID
	notifications, err := h.notificationService.GetNotifications(c.Request().Context(), userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, notifications)
}

// PATCH /notifications/:id/read
//
//	@Summary	Mark notification as read
//	@Description	Marks a notification as read for the authenticated user.
//	@Tags		notifications
//	@Param		id	path		string	true	"Notification ID"
//	@Success	204
//	@Failure	400	{object}	ErrorResponse	"invalid notification id"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Failure	404	{object}	ErrorResponse	"notification not found"
//	@Failure	500	{object}	ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/notifications/{id}/read [patch]
func (h notificationRouteHandler) notificationReadPATCHHandle(c *echo.Context) error {
	notificationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid notification id"})
	}

	userID := h.authService.GetClaims(c).UserID
	if err := h.notificationService.MarkAsRead(c.Request().Context(), userID, notificationID); err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}

// DELETE /notifications/:id
//
//	@Summary	Delete notification
//	@Description	Deletes a notification for the authenticated user.
//	@Tags		notifications
//	@Param		id	path		string	true	"Notification ID"
//	@Success	204
//	@Failure	400	{object}	ErrorResponse	"invalid notification id"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Failure	404	{object}	ErrorResponse	"notification not found"
//	@Failure	500	{object}	ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/notifications/{id} [delete]
func (h notificationRouteHandler) notificationDELETEHandle(c *echo.Context) error {
	notificationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid notification id"})
	}

	userID := h.authService.GetClaims(c).UserID
	if err := h.notificationService.DeleteNotification(c.Request().Context(), userID, notificationID); err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}