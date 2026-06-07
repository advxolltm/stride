import type {
    WSMessageMeta,
    WSMessageType as ProjectWSMessageType,
} from '../realtime/realtime.types'
import type { ApiWhiteboardElement } from './whiteboard.api.types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

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

export type WhiteboardLiveClientMessageMeta = {
    clientId: string
    operationId?: string
}

export type WhiteboardLiveUpdateClientMessage = {
    type: typeof ProjectWSMessageType.WhiteboardElementLiveUpdate
    meta: WhiteboardLiveClientMessageMeta
    payload: WhiteboardLiveUpdateEventPayload
}

export type WhiteboardLiveClearClientMessage = {
    type: typeof ProjectWSMessageType.WhiteboardElementLiveClear
    meta: WhiteboardLiveClientMessageMeta
    payload: WhiteboardLiveClearEventPayload
}

export type WhiteboardLiveClientMessage =
    | WhiteboardLiveUpdateClientMessage
    | WhiteboardLiveClearClientMessage

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

export type WhiteboardSocketEventMessage =
    | WhiteboardEventMessage
    | WhiteboardLiveEventMessage
