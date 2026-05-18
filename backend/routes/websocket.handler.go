package routes

import (
	"backend/services/auth"
	"backend/services/project"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type WSRouteHandler struct {
	upgrader       websocket.Upgrader
	authService    auth.AuthService
	projectService project.ProjectService
	rdb            *redis.Client
}

func NewWSRouteHandler(authService auth.AuthService, projectService project.ProjectService, rdb *redis.Client) *WSRouteHandler {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	return &WSRouteHandler{
		upgrader,
		authService,
		projectService,
		rdb,
	}
}

func (h WSRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/ws")
	g.GET("/connect/:id", h.ConnectGET, h.authService.AuthenticatedMiddleware())
}

//	@Summary	Connect to a project channel to receive all updates for the project in real-time.
//	@Tags		websocket
//	@Param		id	path	string	true	"Project ID"
//	@Success	200
//	@Failure	400	{object}	ErrorResponse	"invalid project id"
//	@Failure	401	{object}	ErrorResponse	"unauthorized"
//	@Router		/ws/connect/{id} [get]
//	@Security	Auth
func (h WSRouteHandler) ConnectGET(c *echo.Context) error {
	ctx := c.Request().Context()
	channel, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}
	claims := h.authService.GetClaims(c)
	expiry := claims.ExpiresAt.Time

	isProjectMember, err := h.projectService.IsProjectMember(ctx, claims.UserID, channel)
	if !isProjectMember || err != nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
	}

	ws, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade", "error", err)
		return c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
	}
	defer func() {
		err := ws.Close()
		if err != nil {
			slog.Error("failed to close websocket connection", "error", err)
		}
	}()

	sub := h.rdb.Subscribe(ctx, channel.String())
	defer func() {
		err := sub.Close()
		if err != nil {
			slog.Error("failed to close redis sub", "error", err)
		}
	}()
	ch := sub.Channel()

	for msg := range ch {
		if expiry.Before(time.Now()) {
			slog.Debug("Client session expired, closing ws connection", "user-id", claims.UserID)
			break
		}

		if err := ws.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
			slog.Error("Write error", "error", err)
		}
	}

	slog.Debug("Closing ws connection", "user-id", claims.UserID)
	return nil
}
