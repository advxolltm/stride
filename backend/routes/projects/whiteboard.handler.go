package projects

import (
	"errors"
	"net/http"

	whiteboardDB "backend/db/whiteboard"
	"backend/models"
	"backend/routes"
	whiteboardSvc "backend/services/whiteboard"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"gorm.io/datatypes"
)

type whiteboardRouteHandler struct {
	whiteboardService whiteboardSvc.WhiteboardService
}

func newWhiteboardRouteHandler(ws whiteboardSvc.WhiteboardService) *whiteboardRouteHandler {
	return &whiteboardRouteHandler{whiteboardService: ws}
}

func (h *whiteboardRouteHandler) registerRoutes(g *echo.Group) {
	g.GET("/:id/whiteboard", h.whiteboardGETHandle)
	g.PATCH("/:id/whiteboard", h.whiteboardPATCHHandle)

	g.GET("/:id/whiteboard/elements", h.elementsGETHandle)
	g.GET("/:id/whiteboard/elements/:elementId", h.elementGETHandle)
	g.POST("/:id/whiteboard/elements", h.elementPOSTHandle)
	g.PATCH("/:id/whiteboard/elements/:elementId", h.elementPATCHHandle)
	g.DELETE("/:id/whiteboard/elements/:elementId", h.elementDELETEHandle)
}

type updateWhiteboardRequest struct {
	CanvasState *datatypes.JSON `json:"canvasState"`
}

type createElementRequest struct {
	ElementType string         `json:"elementType"`
	Props       datatypes.JSON `json:"props"`
	ZIndex      int            `json:"zIndex"`
}

type updateElementRequest struct {
	ElementType *string         `json:"elementType"`
	Props       *datatypes.JSON `json:"props"`
	ZIndex      *int            `json:"zIndex"`
}

func mapServiceErrorWB(err error) (int, string) {
	switch {
	case errors.Is(err, whiteboardSvc.ErrWhiteboardNotFound):
		return http.StatusNotFound, err.Error()
	case errors.Is(err, whiteboardSvc.ErrElementNotFound):
		return http.StatusNotFound, err.Error()
	default:
		return http.StatusInternalServerError, "internal server error"
	}
}

// GET /projects/:id/whiteboard
func (h *whiteboardRouteHandler) whiteboardGETHandle(c *echo.Context) error {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	wb, err := h.whiteboardService.GetOrCreateWhiteboardByProjectID(c.Request().Context(), projectID)
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, wb)
}

// PATCH /projects/:id/whiteboard
func (h *whiteboardRouteHandler) whiteboardPATCHHandle(c *echo.Context) error {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	var req updateWhiteboardRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	wb, err := h.whiteboardService.UpdateWhiteboardByProjectID(c.Request().Context(), projectID, whiteboardDB.UpdateWhiteboardFields{
		CanvasState: req.CanvasState,
	})
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, wb)
}

// GET /projects/:id/whiteboard/elements
func (h *whiteboardRouteHandler) elementsGETHandle(c *echo.Context) error {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	elements, err := h.whiteboardService.GetElements(c.Request().Context(), projectID)
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, elements)
}

// GET /projects/:id/whiteboard/elements/:elementId
func (h *whiteboardRouteHandler) elementGETHandle(c *echo.Context) error {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	elementID, err := uuid.Parse(c.Param("elementId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid element id"})
	}

	element, err := h.whiteboardService.GetElement(c.Request().Context(), projectID, elementID)
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, element)
}

// POST /projects/:id/whiteboard/elements
func (h *whiteboardRouteHandler) elementPOSTHandle(c *echo.Context) error {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	var req createElementRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid request body"})
	}

	element := &models.WhiteboardElement{
		ElementType: req.ElementType,
		Props:       req.Props,
		ZIndex:      req.ZIndex,
	}

	created, err := h.whiteboardService.CreateElement(c.Request().Context(), projectID, element)
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusCreated, created)
}

// PATCH /projects/:id/whiteboard/elements/:elementId
func (h *whiteboardRouteHandler) elementPATCHHandle(c *echo.Context) error {
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

	updated, err := h.whiteboardService.UpdateElement(c.Request().Context(), projectID, elementID, whiteboardDB.UpdateElementFields{
		ElementType: req.ElementType,
		Props:       req.Props,
		ZIndex:      req.ZIndex,
	})
	if err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.JSON(http.StatusOK, updated)
}

// DELETE /projects/:id/whiteboard/elements/:elementId
func (h *whiteboardRouteHandler) elementDELETEHandle(c *echo.Context) error {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid project id"})
	}

	elementID, err := uuid.Parse(c.Param("elementId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, routes.ErrorResponse{Error: "invalid element id"})
	}

	if err := h.whiteboardService.DeleteElement(c.Request().Context(), projectID, elementID); err != nil {
		status, msg := mapServiceErrorWB(err)
		return c.JSON(status, routes.ErrorResponse{Error: msg})
	}

	return c.NoContent(http.StatusNoContent)
}