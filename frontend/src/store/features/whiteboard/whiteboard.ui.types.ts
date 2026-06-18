import type {
    WhiteboardCursorPresence,
    WhiteboardSocketEventMessage,
    WhiteboardLiveUpdateEventPayload,
} from './whiteboard.socket.types'

export type WhiteboardSocketStatus =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error'

export type WhiteboardCursorSocketState = {
    projectId: string
    url: string
    status: WhiteboardSocketStatus
    presence: WhiteboardCursorPresence[]
    lastSnapshotAt: string | null
    lastError: string | null
}

export type WhiteboardEventsSocketState = {
    projectId: string
    url: string
    status: WhiteboardSocketStatus
    liveElementsById: Record<string, WhiteboardLiveUpdateEventPayload>
    remoteSelectionClientIdsByElementId: Record<string, string[]>
    lastMessage: WhiteboardSocketEventMessage | null
    lastMessageAt: string | null
    lastError: string | null
}
