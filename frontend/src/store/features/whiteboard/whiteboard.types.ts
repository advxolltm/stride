import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export type ApiWhiteboard = {
    id: string
    projectId: string
    createdAt: string
    updatedAt: string
}

export type ApiWhiteboardElement = {
    id: string
    whiteboardId: string
    createdBy: string | null
    elementType: string
    props: ExcalidrawElement
    zIndex: number
    createdAt: string
    updatedAt: string
}

export type Whiteboard = {
    id: string
    projectId: string
    createdAt: string
    updatedAt: string
}

export type WhiteboardElement = {
    id: string
    whiteboardId: string
    createdBy: string | null
    elementType: string
    props: ExcalidrawElement
    zIndex: number
    createdAt: string
    updatedAt: string
}

export type CreateWhiteboardElementRequest = {
    elementType: string
    props: ExcalidrawElement
    zIndex: number
}

export type UpdateWhiteboardElementRequest = {
    elementType?: string
    props?: ExcalidrawElement
    zIndex?: number
}
export type WhiteboardCursorUser = {
    id: string
    name: string
    avatarSmall: string
}

export type WhiteboardCursorPosition = {
    x: number | null
    y: number | null
}

export type WhiteboardCursorPresence = {
    user: WhiteboardCursorUser
    cursor: WhiteboardCursorPosition
}

export type WhiteboardCursorClientMessage = {
    cursor: WhiteboardCursorPosition
}

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

export type WhiteboardDeleteEventPayload = {
    elementId: string
}

export type WhiteboardEventMessage<T = unknown> = {
    type: number
    meta?: {
        projectId: string
        originUserId?: string
        clientId?: string
        operationId?: string
        sentAt: string
    }
    payload: T
}

export type WhiteboardEventsSocketState = {
    projectId: string
    url: string
    status: WhiteboardSocketStatus
    lastMessage:
        | WhiteboardEventMessage<
              WhiteboardElement | WhiteboardDeleteEventPayload
          >
        | null
    lastMessageAt: string | null
    lastError: string | null
}
