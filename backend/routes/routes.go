package routes

import "github.com/labstack/echo/v5"


// A general RouteHandler interface.
// Used to later iterate over all handlers, each adding their routes they handle, to the echo router.
type RouteHandler interface {
	AddRoutes(e *echo.Echo)
}
