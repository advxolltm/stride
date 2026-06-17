package websocket

import (
	"backend/routes"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type HubMessageFilter func(routes.WSMessageType) bool

func forwardFilteredHubMessages(
	messages <-chan HubMessage,
	conn *websocket.Conn,
	writeMu *sync.Mutex,
	expiry time.Time,
	filter HubMessageFilter,
	errCh chan<- error,
) {
	for msg := range messages {
		if isWSSessionExpired(expiry) {
			errCh <- nil
			return
		}

		if filter != nil && !filter(msg.Type) {
			continue
		}

		if err := writeWSMessage(conn, writeMu, websocket.TextMessage, msg.Payload); err != nil {
			errCh <- err
			return
		}
	}
	errCh <- nil
}

func isTaskWSEventType(t routes.WSMessageType) bool {
	switch t {
	case routes.TaskCreate,
		routes.TaskUpdate,
		routes.TaskDelete,
		routes.TaskMove,
		routes.TaskAssign,
		routes.TaskUnassign,
		routes.TaskSkillAdded,
		routes.TaskSkillRemoved:
		return true
	default:
		return false
	}
}

func isChatWSEventType(t routes.WSMessageType) bool {
	switch t {
	case routes.ChatMessageCreate,
		routes.ChatMessageUpdate,
		routes.ChatMessageDelete:
		return true
	default:
		return false
	}
}

func isProjectWSEventType(t routes.WSMessageType) bool {
	switch t {
	case routes.ProjectMemberAdd,
		routes.ProjectMemberRemove,
		routes.ProjectSkillAdd,
		routes.ProjectSkillRemove,
		routes.ProjectUpdate,
		routes.ProjectDelete:
		return true
	default:
		return false
	}
}

func isWhiteboardWSEventType(t routes.WSMessageType) bool {
	switch t {
	case routes.WhiteboardElementCreate,
		routes.WhiteboardElementUpdate,
		routes.WhiteboardElementDelete,
		routes.WhiteboardElementLiveUpdate,
		routes.WhiteboardElementLiveClear,
		routes.WhiteboardElementRollback,
		routes.WhiteboardElementSelectionUpdate:
		return true
	default:
		return false
	}
}
