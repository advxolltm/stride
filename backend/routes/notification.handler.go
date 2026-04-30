package routes

import (
	"errors"
	"net/http"

	authService "backend/services/auth"
	notificationService "backend/services/notification"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

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

func (h notificationRouteHandler) notificationsGETHandle(c *echo.Context) error {
	userID := h.authService.GetClaims(c).UserID
	notifications, err := h.notificationService.GetNotifications(c.Request().Context(), userID)
	if err != nil {
		status, msg := h.mapServiceError(err)
		return c.JSON(status, ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, notifications)
}


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