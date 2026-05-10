import { WSMessageType } from '../projectSocket/projectSocket.types'
import type {
    ApiWhiteboardElement,
    WhiteboardDeleteEventPayload,
    WhiteboardElement,
    WhiteboardEventMessage,
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

const isWhiteboardEventType = (value: unknown): value is number =>
    value === WSMessageType.WhiteboardElementCreate ||
    value === WSMessageType.WhiteboardElementUpdate ||
    value === WSMessageType.WhiteboardElementDelete

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

export const parseWhiteboardEventMessage = (
    rawMessage: string,
): WhiteboardEventMessage | null => {
    try {
        const parsed = JSON.parse(rawMessage) as Partial<{
            type: number
            meta?: WhiteboardEventMessage['meta']
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

        return parsed as WhiteboardEventMessage
    } catch {
        return null
    }
}

export const isSelfOriginatedWhiteboardEvent = (
    message: WhiteboardEventMessage,
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
