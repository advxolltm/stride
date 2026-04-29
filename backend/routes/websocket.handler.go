package routes

import (
	websocketroutes "backend/routes/websocket"
	"backend/services/auth"
	"backend/services/project"

	"github.com/redis/go-redis/v9"
)

type WSRouteHandler = websocketroutes.WSRouteHandler

func NewWSRouteHandler(authService auth.AuthService, projectService project.ProjectService, rdb *redis.Client) *WSRouteHandler {
	return websocketroutes.NewWSRouteHandler(authService, projectService, rdb)
}
