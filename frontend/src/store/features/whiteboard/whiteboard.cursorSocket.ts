import { buildApiWebSocketUrl } from '../../api/base.api'
import { watchManagedSocket } from '../realtime/realtime.socketRuntime'
import type {
    WhiteboardCursorClientMessage,
    WhiteboardCursorPresence,
} from './whiteboard.socket.types'
import type { WhiteboardCursorSocketState } from './whiteboard.ui.types'

export type WhiteboardCursorSocketLifecycleApi = {
    cacheDataLoaded: Promise<unknown>
    cacheEntryRemoved: Promise<void>
    updateCachedData: (
        recipe: (draft: WhiteboardCursorSocketState) => void,
    ) => void
}

const activeWhiteboardCursorSockets = new Map<string, WebSocket>()

const createWhiteboardCursorSocketUrl = (projectId: string) =>
    buildApiWebSocketUrl(`/ws/project/${projectId}/whiteboard/cursor`)

export const createWhiteboardCursorSocketState = (
    projectId: string,
): WhiteboardCursorSocketState => ({
    projectId,
    url: createWhiteboardCursorSocketUrl(projectId),
    status: 'connecting',
    presence: [],
    lastSnapshotAt: null,
    lastError: null,
})

const isWhiteboardCursorPresence = (
    value: unknown,
): value is WhiteboardCursorPresence => {
    if (!value || typeof value !== 'object') {
        return false
    }

    const record = value as Partial<WhiteboardCursorPresence>
    const user = record.user
    const cursor = record.cursor

    return (
        !!user &&
        typeof user === 'object' &&
        typeof user.id === 'string' &&
        typeof user.name === 'string' &&
        typeof user.avatarSmall === 'string' &&
        !!cursor &&
        typeof cursor === 'object' &&
        (cursor.x === null || typeof cursor.x === 'number') &&
        (cursor.y === null || typeof cursor.y === 'number')
    )
}

const parseWhiteboardCursorSnapshot = (rawMessage: string) => {
    try {
        const parsed = JSON.parse(rawMessage) as unknown
        if (!Array.isArray(parsed)) {
            return null
        }

        return parsed.every(isWhiteboardCursorPresence) ? parsed : null
    } catch {
        return null
    }
}

export const watchWhiteboardCursorSocket = async (
    projectId: string,
    lifecycleApi: WhiteboardCursorSocketLifecycleApi,
) => {
    await watchManagedSocket({
        cacheDataLoaded: lifecycleApi.cacheDataLoaded,
        cacheEntryRemoved: lifecycleApi.cacheEntryRemoved,
        createSocket: () =>
            new WebSocket(createWhiteboardCursorSocketUrl(projectId)),
        createSocketEventHandlers: (socket, controls) => ({
            open: () => {
                activeWhiteboardCursorSockets.set(projectId, socket)
                lifecycleApi.updateCachedData((draft) => {
                    draft.status = 'connected'
                    draft.lastError = null
                })
            },
            message: (event) => {
                if (typeof event.data !== 'string') {
                    return
                }

                const snapshot = parseWhiteboardCursorSnapshot(event.data)
                if (!snapshot) {
                    controls.reportParseError(
                        'Failed to parse whiteboard cursor snapshot',
                    )
                    lifecycleApi.updateCachedData((draft) => {
                        draft.lastError =
                            'Failed to parse whiteboard cursor snapshot'
                    })
                    return
                }

                lifecycleApi.updateCachedData((draft) => {
                    draft.presence = snapshot
                    draft.lastSnapshotAt = new Date().toISOString()
                })
            },
            error: () => {
                lifecycleApi.updateCachedData((draft) => {
                    draft.status = 'error'
                    draft.lastError =
                        'Failed to establish whiteboard cursor websocket connection'
                })
            },
            close: () => {
                activeWhiteboardCursorSockets.delete(projectId)
                lifecycleApi.updateCachedData((draft) => {
                    if (draft.status !== 'error') {
                        draft.status = 'disconnected'
                    }
                })
            },
        }),
        onFinally: () => {
            activeWhiteboardCursorSockets.delete(projectId)
        },
    })
}

export const sendWhiteboardCursor = (
    projectId: string,
    message: WhiteboardCursorClientMessage,
) => {
    const socket = activeWhiteboardCursorSockets.get(projectId)
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false
    }

    socket.send(JSON.stringify(message))
    return true
}
