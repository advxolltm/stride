import { WSMessageType } from '../projectSocket/projectSocket.types'
import type {
    ApiWhiteboardElement,
    WhiteboardDeleteEventPayload,
    WhiteboardElement,
    WhiteboardEventMessage,
    WhiteboardLiveClientMessage,
    WhiteboardLiveClearEventPayload,
    WhiteboardLiveEventMessage,
    WhiteboardLiveUpdateEventPayload,
    WhiteboardSocketEventMessage,
} from './whiteboard.types'

const WHITEBOARD_CLIENT_ID_STORAGE_KEY = 'whiteboard-client-id'

let serverSideWhiteboardClientID: string | null = null

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isWhiteboardElementEventPayload = (
    value: unknown,
): value is ApiWhiteboardElement =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.whiteboardId === 'string' &&
    typeof value.elementType === 'string' &&
    typeof value.zIndex === 'number'

const isWhiteboardDeleteEventPayload = (
    value: unknown,
): value is WhiteboardDeleteEventPayload =>
    isRecord(value) && typeof value.elementId === 'string'

const isWhiteboardLiveUpdateEventPayload = (
    value: unknown,
): value is WhiteboardLiveUpdateEventPayload =>
    isRecord(value) &&
    typeof value.elementId === 'string' &&
    typeof value.elementType === 'string' &&
    typeof value.zIndex === 'number' &&
    isRecord(value.props) &&
    typeof value.props.id === 'string'

const isWhiteboardLiveClearEventPayload = (
    value: unknown,
): value is WhiteboardLiveClearEventPayload =>
    isRecord(value) && typeof value.elementId === 'string'

const isWhiteboardEventType = (value: unknown): value is number =>
    value === WSMessageType.WhiteboardElementCreate ||
    value === WSMessageType.WhiteboardElementUpdate ||
    value === WSMessageType.WhiteboardElementDelete ||
    value === WSMessageType.WhiteboardElementLiveUpdate ||
    value === WSMessageType.WhiteboardElementLiveClear

export const generateWhiteboardRequestID = () => {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const getWhiteboardClientID = () => {
    if (typeof window === 'undefined') {
        serverSideWhiteboardClientID ??= generateWhiteboardRequestID()
        return serverSideWhiteboardClientID
    }

    const storedClientID = window.sessionStorage.getItem(
        WHITEBOARD_CLIENT_ID_STORAGE_KEY,
    )
    if (storedClientID) {
        return storedClientID
    }

    const nextClientID = generateWhiteboardRequestID()
    window.sessionStorage.setItem(
        WHITEBOARD_CLIENT_ID_STORAGE_KEY,
        nextClientID,
    )
    return nextClientID
}

export const createWhiteboardMutationHeaders = () => ({
    'X-Client-Id': getWhiteboardClientID(),
    'X-Operation-Id': generateWhiteboardRequestID(),
})

export const createWhiteboardLiveClientMessageMeta = () => ({
    clientId: getWhiteboardClientID(),
    operationId: generateWhiteboardRequestID(),
})

export const serializeWhiteboardLiveClientMessage = (
    message: WhiteboardLiveClientMessage,
) => JSON.stringify(message)

export const parseWhiteboardEventMessage = (
    rawMessage: string,
): WhiteboardSocketEventMessage | null => {
    try {
        const parsed = JSON.parse(rawMessage) as Partial<{
            type: number
            meta?: WhiteboardSocketEventMessage['meta']
            payload: unknown
        }>

        if (!isWhiteboardEventType(parsed.type)) {
            return null
        }

        if (
            parsed.type === WSMessageType.WhiteboardElementDelete &&
            !isWhiteboardDeleteEventPayload(parsed.payload)
        ) {
            return null
        }

        if (
            (parsed.type === WSMessageType.WhiteboardElementCreate ||
                parsed.type === WSMessageType.WhiteboardElementUpdate) &&
            !isWhiteboardElementEventPayload(parsed.payload)
        ) {
            return null
        }

        if (
            parsed.type === WSMessageType.WhiteboardElementLiveUpdate &&
            !isWhiteboardLiveUpdateEventPayload(parsed.payload)
        ) {
            return null
        }

        if (
            parsed.type === WSMessageType.WhiteboardElementLiveClear &&
            !isWhiteboardLiveClearEventPayload(parsed.payload)
        ) {
            return null
        }

        return parsed as WhiteboardSocketEventMessage
    } catch {
        return null
    }
}

export const logWhiteboardEventMessage = (
    message: WhiteboardSocketEventMessage,
) => {
    switch (message.type) {
        case WSMessageType.WhiteboardElementCreate:
            console.log('WhiteboardElementCreate event:', message)
            return
        case WSMessageType.WhiteboardElementUpdate:
            console.log('WhiteboardElementUpdate event:', message)
            return
        case WSMessageType.WhiteboardElementDelete:
            console.log('WhiteboardElementDelete event:', message)
            return
        case WSMessageType.WhiteboardElementLiveUpdate:
            console.log('WhiteboardElementLiveUpdate event:', message)
            return
        case WSMessageType.WhiteboardElementLiveClear:
            console.log('WhiteboardElementLiveClear event:', message)
            return
        default:
            return
    }
}

export const isSelfOriginatedWhiteboardEvent = (
    message: WhiteboardSocketEventMessage,
) => {
    const originClientID = message.meta?.clientId
    if (!originClientID) {
        return false
    }

    return originClientID === getWhiteboardClientID()
}

export const applyWhiteboardEventToElementsCache = (
    draft: WhiteboardElement[],
    message: WhiteboardEventMessage,
    transformWhiteboardElement: (
        element: ApiWhiteboardElement,
    ) => WhiteboardElement,
) => {
    switch (message.type) {
        case WSMessageType.WhiteboardElementCreate:
        case WSMessageType.WhiteboardElementUpdate: {
            const element = transformWhiteboardElement(message.payload)
            const existingIndex = draft.findIndex(
                (item) => item.id === element.id,
            )

            if (existingIndex === -1) {
                draft.push(element as never)
                return
            }

            Object.assign(draft[existingIndex], element)
            return
        }
        case WSMessageType.WhiteboardElementDelete:
            return draft.filter((item) => item.id !== message.payload.elementId)
        default:
            return
    }
}

export const applyWhiteboardLiveEventToOverlay = (
    liveElementsByID: Record<string, WhiteboardLiveUpdateEventPayload>,
    message: WhiteboardLiveEventMessage,
) => {
    switch (message.type) {
        case WSMessageType.WhiteboardElementLiveUpdate:
            liveElementsByID[message.payload.elementId] = message.payload
            return
        case WSMessageType.WhiteboardElementLiveClear:
            delete liveElementsByID[message.payload.elementId]
            return
        default:
            return
    }
}
