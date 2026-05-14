package projects

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	whiteboardDB "backend/db/whiteboard"
	"backend/models"
	"backend/routes"
	authSvc "backend/services/auth"
	whiteboardSvc "backend/services/whiteboard"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
	"gorm.io/datatypes"
)

type whiteboardRouteHandler struct {
	authService       authSvc.AuthService
	whiteboardService whiteboardSvc.WhiteboardService
	rdb               *redis.Client
}

func newWhiteboardRouteHandler(
	ws whiteboardSvc.WhiteboardService,
	authService authSvc.AuthService,
	rdb *redis.Client,
) *whiteboardRouteHandler {
	return &whiteboardRouteHandler{
		authService:       authService,
		whiteboardService: ws,
		rdb:               rdb,
	}
}

func (h *whiteboardRouteHandler) registerRoutes(g *echo.Group) {
	g.GET("/:id/whiteboard", h.whiteboardGETHandle)
	g.POST("/:id/whiteboard", h.whiteboardPOSTHandle)

	g.GET("/:id/whiteboard/elements", h.elementsGETHandle)
	g.GET("/:id/whiteboard/elements/:elementId", h.elementGETHandle)
	g.POST("/:id/whiteboard/elements", h.elementPOSTHandle)
	g.PATCH("/:id/whiteboard/elements/:elementId", h.elementPATCHHandle)
	g.DELETE("/:id/whiteboard/elements/:elementId", h.elementDELETEHandle)
}

// whiteboardResponse represents a whiteboard in API responses.
type whiteboardResponse struct { //nolint:unused
	ID          string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	ProjectID   string `json:"projectId" example:"550e8400-e29b-41d4-a716-446655440000"`
	CanvasState any    `json:"canvasState"`
	CreatedAt   string `json:"createdAt" example:"2026-01-01T00:00:00Z"`
	UpdatedAt   string `json:"updatedAt" example:"2026-01-01T00:00:00Z"`
}

// whiteboardElementResponse represents a whiteboard element in API responses.
type whiteboardElementResponse struct { //nolint:unused
	ID           string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	WhiteboardID string `json:"whiteboardId" example:"550e8400-e29b-41d4-a716-446655440000"`
	CreatedBy    string `json:"createdBy" example:"550e8400-e29b-41d4-a716-446655440000"`
	ElementType  string `json:"elementType" example:"rectangle"`
	Props        any    `json:"props"`
	ZIndex       int    `json:"zIndex" example:"1"`
	CreatedAt    string `json:"createdAt" example:"2026-01-01T00:00:00Z"`
	UpdatedAt    string `json:"updatedAt" example:"2026-01-01T00:00:00Z"`
}

type whiteboardElementWSUpdate struct {
	ID           uuid.UUID      `json:"id"`
	WhiteboardID uuid.UUID      `json:"whiteboardId"`
	CreatedBy    *uuid.UUID     `json:"createdBy"`
	ElementType  string         `json:"elementType"`
	Props        datatypes.JSON `json:"props"`
	ZIndex       int            `json:"zIndex"`
	CreatedAt    string         `json:"createdAt"`
	UpdatedAt    string         `json:"updatedAt"`
}

type whiteboardElementDeleteWSUpdate struct {
	ElementID uuid.UUID `json:"elementId"`
}

type createElementRequest struct {
	ElementType string         `json:"elementType"`
	Props       datatypes.JSON `json:"props" swaggertype:"object"`
	ZIndex      int            `json:"zIndex"`
}

type createWhiteboardRequest struct {
	CanvasState datatypes.JSON `json:"canvasState" swaggertype:"object"`
}

type updateElementRequest struct {
	ElementType *string         `json:"elementType"`
	Props       *datatypes.JSON `json:"props" swaggertype:"object"`
	ZIndex      *int            `json:"zIndex"`
}

func readWhiteboardRequestMetadata(c *echo.Context) (clientID string, operationID string) {
	return c.Request().Header.Get("X-Client-Id"), c.Request().Header.Get("X-Operation-Id")
}

func mapWhiteboardElementWSUpdate(element *models.WhiteboardElement) whiteboardElementWSUpdate {
	return whiteboardElementWSUpdate{
		ID:           element.ID,
		WhiteboardID: element.WhiteboardID,
		CreatedBy:    element.CreatedBy,
		ElementType:  element.ElementType,
		Props:        element.Props,
		ZIndex:       element.ZIndex,
		CreatedAt:    element.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    element.UpdatedAt.Format(time.RFC3339),
	}
}

func mapServiceErrorWB(err error) (int, string) {
	switch {
	case errors.Is(err, authSvc.ErrUserIDNotInContext):
		return http.StatusUnauthorized, authSvc.ErrUnauthorized.Error()
	case errors.Is(err, authSvc.ErrAccessDenied):
		return http.StatusForbidden, err.Error()
	case errors.Is(err, whiteboardSvc.ErrWhiteboardNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, whiteboardSvc.ErrElementNotFound):
		return http.StatusNotFound, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

// GET /projects/:id/whiteboard
//
//	@Summary	Get or create whiteboard for a project
//	@Tags		whiteboard
//	@Param		id	path		string	true	"Project ID"
//	@Success	200	{object}	whiteboardResponse
//	@Failure	400	{object}	routes.ErrorResponse	"invalid project id"
//	@Failure	401	{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	403	{object}	routes.ErrorResponse	"forbidden"
//	@Failure	404	{object}	routes.ErrorResponse	"whiteboard not found"
//	@Failure	500	{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/projects/{id}/whiteboard [get]
func (h *whiteboardRouteHandler) whiteboardGETHandle(c *echo.Context) error {
	userID := h.authService.GetClaims(c).UserID
	if userID == uuid.Nil {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: authSvc.ErrUnauthorized.Error()})
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	wb, err := h.whiteboardService.GetOrCreateWhiteboardByProjectID(c.Request().Context(), userID, projectID)
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, wb)
}

// POST /projects/:id/whiteboard
//
//	@Summary	Create or update whiteboard canvas state for a project
//	@Tags		whiteboard
//	@Param		id		path		string				true	"Project ID"
//	@Param		body	body		createWhiteboardRequest	true	"Whiteboard data"
//	@Success	200		{object}	whiteboardResponse
//	@Failure	400		{object}	routes.ErrorResponse	"invalid request body"
//	@Failure	401		{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	403		{object}	routes.ErrorResponse	"forbidden"
//	@Failure	404		{object}	routes.ErrorResponse	"whiteboard not found"
//	@Failure	500		{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/projects/{id}/whiteboard [post]
func (h *whiteboardRouteHandler) whiteboardPOSTHandle(c *echo.Context) error {
	userID := h.authService.GetClaims(c).UserID
	if userID == uuid.Nil {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: authSvc.ErrUnauthorized.Error()})
	}

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	var req createWhiteboardRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	wb, err := h.whiteboardService.UpdateCanvasState(c.Request().Context(), userID, projectID, req.CanvasState)
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, wb)
}

// GET /projects/:id/whiteboard/elements
//
//	@Summary	List all elements of a whiteboard
//	@Tags		whiteboard
//	@Param		id	path		string	true	"Project ID"
//	@Success	200	{array}		whiteboardElementResponse
//	@Failure	400	{object}	routes.ErrorResponse	"invalid project id"
//	@Failure	401	{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	403	{object}	routes.ErrorResponse	"forbidden"
//	@Failure	404	{object}	routes.ErrorResponse	"whiteboard not found"
//	@Failure	500	{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/projects/{id}/whiteboard/elements [get]
func (h *whiteboardRouteHandler) elementsGETHandle(c *echo.Context) error {
	userID := h.authService.GetClaims(c).UserID
	if userID == uuid.Nil {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: authSvc.ErrUnauthorized.Error()})
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	elements, err := h.whiteboardService.GetElements(c.Request().Context(), userID, projectID)
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, elements)
}

// GET /projects/:id/whiteboard/elements/:elementId
//
//	@Summary	Get a single whiteboard element
//	@Tags		whiteboard
//	@Param		id			path		string	true	"Project ID"
//	@Param		elementId	path		string	true	"Element ID"
//	@Success	200			{object}	whiteboardElementResponse
//	@Failure	400			{object}	routes.ErrorResponse	"invalid project or element id"
//	@Failure	401			{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	403			{object}	routes.ErrorResponse	"forbidden"
//	@Failure	404			{object}	routes.ErrorResponse	"element not found"
//	@Failure	500			{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/projects/{id}/whiteboard/elements/{elementId} [get]
func (h *whiteboardRouteHandler) elementGETHandle(c *echo.Context) error {
	userID := h.authService.GetClaims(c).UserID
	if userID == uuid.Nil {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: authSvc.ErrUnauthorized.Error()})
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	elementID, err := uuid.Parse(c.Param("elementId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid element id"})
	}

	element, err := h.whiteboardService.GetElement(c.Request().Context(), userID, projectID, elementID)
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, element)
}

// POST /projects/:id/whiteboard/elements
//
//	@Summary	Create a new whiteboard element
//	@Tags		whiteboard
//	@Param		id		path		string					true	"Project ID"
//	@Param		body	body		createElementRequest	true	"Element data"
//	@Success	201		{object}	whiteboardElementResponse
//	@Failure	400		{object}	routes.ErrorResponse	"invalid request body"
//	@Failure	401		{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	403		{object}	routes.ErrorResponse	"forbidden"
//	@Failure	404		{object}	routes.ErrorResponse	"whiteboard not found"
//	@Failure	500		{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/projects/{id}/whiteboard/elements [post]
func (h *whiteboardRouteHandler) elementPOSTHandle(c *echo.Context) error {
	userID := h.authService.GetClaims(c).UserID
	if userID == uuid.Nil {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: authSvc.ErrUnauthorized.Error()})
	}
	clientID, operationID := readWhiteboardRequestMetadata(c)
	_ = clientID
	_ = operationID

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	var req createElementRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	element := &models.WhiteboardElement{
		CreatedBy:   &userID,
		ElementType: req.ElementType,
		Props:       req.Props,
		ZIndex:      req.ZIndex,
	}

	created, err := h.whiteboardService.CreateElement(c.Request().Context(), userID, projectID, element)
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	meta := &routes.WSMessageMeta{
		OriginUserID: &userID,
		ClientID:     clientID,
		OperationID:  operationID,
	}
	if err := routes.SendWSUpdateWithMeta(
		c.Request().Context(),
		h.rdb,
		projectID,
		routes.WhiteboardElementCreate,
		meta,
		mapWhiteboardElementWSUpdate(created),
	); err != nil {
		slog.Error("elementPOSTHandle: Failed to send ws update", "error", err)
	}

	return c.JSON(http.StatusCreated, created)
}

// PATCH /projects/:id/whiteboard/elements/:elementId
//
//	@Summary	Update a whiteboard element
//	@Tags		whiteboard
//	@Param		id			path		string					true	"Project ID"
//	@Param		elementId	path		string					true	"Element ID"
//	@Param		body		body		updateElementRequest	true	"Element update data"
//	@Success	200			{object}	whiteboardElementResponse
//	@Failure	400			{object}	routes.ErrorResponse	"invalid request body or id"
//	@Failure	401			{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	403			{object}	routes.ErrorResponse	"forbidden"
//	@Failure	404			{object}	routes.ErrorResponse	"element not found"
//	@Failure	500			{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/projects/{id}/whiteboard/elements/{elementId} [patch]
func (h *whiteboardRouteHandler) elementPATCHHandle(c *echo.Context) error {
	userID := h.authService.GetClaims(c).UserID
	if userID == uuid.Nil {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: authSvc.ErrUnauthorized.Error()})
	}
	clientID, operationID := readWhiteboardRequestMetadata(c)
	_ = clientID
	_ = operationID

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	elementID, err := uuid.Parse(c.Param("elementId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid element id"})
	}

	var req updateElementRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	updated, err := h.whiteboardService.UpdateElement(c.Request().Context(), userID, projectID, elementID, whiteboardDB.UpdateElementFields{
		ElementType: req.ElementType,
		Props:       req.Props,
		ZIndex:      req.ZIndex,
	})
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	meta := &routes.WSMessageMeta{
		OriginUserID: &userID,
		ClientID:     clientID,
		OperationID:  operationID,
	}
	if err := routes.SendWSUpdateWithMeta(
		c.Request().Context(),
		h.rdb,
		projectID,
		routes.WhiteboardElementUpdate,
		meta,
		mapWhiteboardElementWSUpdate(updated),
	); err != nil {
		slog.Error("elementPATCHHandle: Failed to send ws update", "error", err)
	}

	return c.JSON(http.StatusOK, updated)
}

// DELETE /projects/:id/whiteboard/elements/:elementId
//
//	@Summary	Delete a whiteboard element
//	@Tags		whiteboard
//	@Param		id			path	string	true	"Project ID"
//	@Param		elementId	path	string	true	"Element ID"
//	@Success	204
//	@Failure	400	{object}	routes.ErrorResponse	"invalid project or element id"
//	@Failure	401	{object}	routes.ErrorResponse	"unauthorized"
//	@Failure	403	{object}	routes.ErrorResponse	"forbidden"
//	@Failure	404	{object}	routes.ErrorResponse	"element not found"
//	@Failure	500	{object}	routes.ErrorResponse	"internal server error"
//	@Security	Auth
//	@Router		/projects/{id}/whiteboard/elements/{elementId} [delete]
func (h *whiteboardRouteHandler) elementDELETEHandle(c *echo.Context) error {
	userID := h.authService.GetClaims(c).UserID
	if userID == uuid.Nil {
		return c.JSON(http.StatusUnauthorized, routes.ErrorResponse{Error: authSvc.ErrUnauthorized.Error()})
	}
	clientID, operationID := readWhiteboardRequestMetadata(c)
	_ = clientID
	_ = operationID

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	elementID, err := uuid.Parse(c.Param("elementId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid element id"})
	}

	if err := h.whiteboardService.DeleteElement(c.Request().Context(), userID, projectID, elementID); err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	meta := &routes.WSMessageMeta{
		OriginUserID: &userID,
		ClientID:     clientID,
		OperationID:  operationID,
	}
	if err := routes.SendWSUpdateWithMeta(
		c.Request().Context(),
		h.rdb,
		projectID,
		routes.WhiteboardElementDelete,
		meta,
		whiteboardElementDeleteWSUpdate{
			ElementID: elementID,
		},
	); err != nil {
		slog.Error("elementDELETEHandle: Failed to send ws update", "error", err)
	}

	return c.NoContent(http.StatusNoContent)
}
