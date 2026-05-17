import type {
    WhiteboardLiveClientMessageMeta,
    WhiteboardSocketEventMessage,
} from './whiteboard.socket.types'

const WHITEBOARD_CLIENT_ID_STORAGE_KEY = 'whiteboard-client-id'

let serverSideWhiteboardClientID: string | null = null

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

export const createWhiteboardLiveClientMessageMeta =
    (): WhiteboardLiveClientMessageMeta => ({
        clientId: getWhiteboardClientID(),
        operationId: generateWhiteboardRequestID(),
    })

export const isSelfOriginatedWhiteboardEvent = (
    message: WhiteboardSocketEventMessage,
) => {
    const originClientID = message.meta?.clientId
    if (!originClientID) {
        return false
    }

    return originClientID === getWhiteboardClientID()
}
