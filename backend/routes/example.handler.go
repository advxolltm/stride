package routes

import (
	"backend/services/auth"
	"backend/services/example"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
)

type ExampleRouteHandler struct {
	exampleService example.ExampleService
	authService    auth.AuthService
	rdb            *redis.Client
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewExampleRouteHandler(exampleService example.ExampleService, authService auth.AuthService, rdb *redis.Client) *ExampleRouteHandler {
	return &ExampleRouteHandler{
		exampleService,
		authService,
		rdb,
	}
}

// The RouteHandler interface is implicitly implemented by "adding" this function to the struct
func (h ExampleRouteHandler) AddRoutes(api *echo.Group) {
	g := api.Group("/example")
	g.GET("/data", h.DataGETHandle)
	g.GET("/data-protected", h.DataProtectedGETHandle, h.authService.AuthenticatedMiddleware())
	g.GET("/channel-connect/:id", h.ChannelConnect)
	g.POST("/channel-post/:id", h.ChannelPost)
}

//	@Summary	Some route to get data
//	@Tags		example
//	@Success	200	{object}	routes.DataGETHandle.dataResponse
//	@Router		/example/data [get]
func (h ExampleRouteHandler) DataGETHandle(c *echo.Context) error {
	type dataResponse struct {
		Value string
	} //	@name	DataResponse

	value, err := h.exampleService.GetData()
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Errorf("you are using the application wrong >:( -> error: %w", err).Error())
	}
	return c.JSON(http.StatusOK, dataResponse{Value: value})
}

//	@Summary	Some route to get data, requires authentication
//	@Tags		example
//	@Success	200	{string}	string
//	@Router		/example/data-protected [get]
//	@Security	Auth
func (h ExampleRouteHandler) DataProtectedGETHandle(c *echo.Context) error {
	claims := h.authService.GetClaims(c)
	userID := claims.UserID

	value, err := h.exampleService.GetData()
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Errorf("you are using the application wrong >:( -> error: %w", err).Error())
	}
	return c.String(http.StatusOK, fmt.Sprintf("Hello user %s! -> %s", userID.String(), value))
}

//	@Summary	Connect to a channel with the given ID
//	@Tags		example
//	@Param		id	path	int	true	"Channel ID"
//	@Success	200
//	@Router		/example/channel-connect/{id} [get]
func (h ExampleRouteHandler) ChannelConnect(c *echo.Context) error {
	ctx := c.Request().Context()
	channel := c.Param("id")

	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		slog.Error("failed to upgrade", "error", err)
		return c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
	}
	defer ws.Close()

	sub := h.rdb.Subscribe(ctx, channel)
	defer sub.Close()
	ch := sub.Channel()

	for {
		for msg := range ch {
			if err := ws.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
				slog.Error("Write error", "error", err)
			}
		}
	}
}

//	@Summary	Send something in a channel with the given ID
//	@Tags		example
//	@Param		id		path		int									true	"Channel ID"
//	@Param		message	body		routes.ChannelPost.channelMessage	true	"Channel Message"
//	@Success	200		{string}	string
//	@Router		/example/channel-post/{id} [post]
func (h ExampleRouteHandler) ChannelPost(c *echo.Context) error {
	type channelMessage struct {
		Type    string `json:"type"`
		Payload string `json:"payload"`
	} //	@name	ChannelMessage

	ctx := c.Request().Context()
	channel, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid project id"})
	}

	var chMsg channelMessage
	if err := c.Bind(&chMsg); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
	}

	type ExampleWSUpdate struct {
		Bla int `json:"bla"`
	}

	if err := SendWSUpdate(ctx, h.rdb, channel, TaskCreate, ExampleWSUpdate{Bla: 32}); err != nil {
		slog.Error("couldn't send WS update, but this is no reason to fail the request", "error", err)
	}

	return c.NoContent(http.StatusOK)
}
