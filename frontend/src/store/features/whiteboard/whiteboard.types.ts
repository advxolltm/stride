import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type {
    WSMessageMeta,
    WSMessageType as ProjectWSMessageType,
} from '../projectSocket/projectSocket.types'

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

export type WhiteboardLiveUpdateEventPayload = {
    elementId: string
    elementType: string
    props: ExcalidrawElement
    zIndex: number
}

export type WhiteboardLiveClearEventPayload = {
    elementId: string
}

export type WhiteboardCreateEventMessage = {
    type: typeof ProjectWSMessageType.WhiteboardElementCreate
    meta?: WSMessageMeta
    payload: ApiWhiteboardElement
}

export type WhiteboardUpdateEventMessage = {
    type: typeof ProjectWSMessageType.WhiteboardElementUpdate
    meta?: WSMessageMeta
    payload: ApiWhiteboardElement
}

export type WhiteboardDeleteEventMessage = {
    type: typeof ProjectWSMessageType.WhiteboardElementDelete
    meta?: WSMessageMeta
    payload: WhiteboardDeleteEventPayload
}

export type WhiteboardLiveUpdateEventMessage = {
    type: typeof ProjectWSMessageType.WhiteboardElementLiveUpdate
    meta?: WSMessageMeta
    payload: WhiteboardLiveUpdateEventPayload
}

export type WhiteboardLiveClearEventMessage = {
    type: typeof ProjectWSMessageType.WhiteboardElementLiveClear
    meta?: WSMessageMeta
    payload: WhiteboardLiveClearEventPayload
}

export type WhiteboardEventMessage =
    | WhiteboardCreateEventMessage
    | WhiteboardUpdateEventMessage
    | WhiteboardDeleteEventMessage

export type WhiteboardLiveEventMessage =
    | WhiteboardLiveUpdateEventMessage
    | WhiteboardLiveClearEventMessage

export type WhiteboardEventsSocketState = {
    projectId: string
    url: string
    status: WhiteboardSocketStatus
    lastMessage:
        | WhiteboardCreateEventMessage
        | WhiteboardUpdateEventMessage
        | WhiteboardDeleteEventMessage
        | null
    lastMessageAt: string | null
    lastError: string | null
}
