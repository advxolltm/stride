import { baseApi, buildApiWebSocketUrl } from '../../api/base.api'
import type {
    WhiteboardCursorClientMessage,
    WhiteboardCursorPresence,
    WhiteboardCursorSocketState,
} from './whiteboard.types'

type WhiteboardCursorSocketLifecycleApi = {
    cacheDataLoaded: Promise<unknown>
    cacheEntryRemoved: Promise<void>
    updateCachedData: (
        recipe: (draft: WhiteboardCursorSocketState) => void,
    ) => void
}

const activeWhiteboardCursorSockets = new Map<string, WebSocket>()

const createWhiteboardCursorSocketUrl = (projectId: string) =>
    buildApiWebSocketUrl(`/ws/project/${projectId}/whiteboard/cursor`)

const createWhiteboardCursorSocketState = (
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

const watchWhiteboardCursorSocket = async (
    projectId: string,
    lifecycleApi: WhiteboardCursorSocketLifecycleApi,
) => {
    if (typeof WebSocket === 'undefined') {
        return
    }

    let socket: WebSocket | null = null
    let handleOpen: (() => void) | null = null
    let handleMessage: ((event: MessageEvent) => void) | null = null
    let handleError: (() => void) | null = null
    let handleClose: (() => void) | null = null

    try {
        await lifecycleApi.cacheDataLoaded

        socket = new WebSocket(createWhiteboardCursorSocketUrl(projectId))

        handleOpen = () => {
            activeWhiteboardCursorSockets.set(projectId, socket!)
            lifecycleApi.updateCachedData((draft) => {
                draft.status = 'connected'
                draft.lastError = null
            })
        }

        handleMessage = (event: MessageEvent) => {
            if (typeof event.data !== 'string') {
                return
            }

            const snapshot = parseWhiteboardCursorSnapshot(event.data)
            if (!snapshot) {
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
        }

        handleError = () => {
            lifecycleApi.updateCachedData((draft) => {
                draft.status = 'error'
                draft.lastError =
                    'Failed to establish whiteboard cursor websocket connection'
            })
        }

        handleClose = () => {
            activeWhiteboardCursorSockets.delete(projectId)
            lifecycleApi.updateCachedData((draft) => {
                if (draft.status !== 'error') {
                    draft.status = 'disconnected'
                }
            })
        }

        socket.addEventListener('open', handleOpen)
        socket.addEventListener('message', handleMessage)
        socket.addEventListener('error', handleError)
        socket.addEventListener('close', handleClose)

        await lifecycleApi.cacheEntryRemoved
    } catch {
        return
    } finally {
        activeWhiteboardCursorSockets.delete(projectId)

        if (
            socket &&
            handleOpen &&
            handleMessage &&
            handleError &&
            handleClose
        ) {
            socket.removeEventListener('open', handleOpen)
            socket.removeEventListener('message', handleMessage)
            socket.removeEventListener('error', handleError)
            socket.removeEventListener('close', handleClose)
        }

        if (
            socket &&
            (socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING)
        ) {
            socket.close()
        }
    }
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

export const whiteboardApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        watchWhiteboardCursor: builder.query<
            WhiteboardCursorSocketState,
            string
        >({
            queryFn: (projectId) => ({
                data: createWhiteboardCursorSocketState(projectId),
            }),
            async onCacheEntryAdded(projectId, lifecycleApi) {
                await watchWhiteboardCursorSocket(projectId, lifecycleApi)
            },
        }),
    }),
})

export const { useWatchWhiteboardCursorQuery } = whiteboardApi
