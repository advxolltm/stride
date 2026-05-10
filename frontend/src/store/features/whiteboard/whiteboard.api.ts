import { baseApi, buildApiWebSocketUrl } from '../../api/base.api'
import type {
    ApiWhiteboard,
    ApiWhiteboardElement,
    CreateWhiteboardElementRequest,
    UpdateWhiteboardElementRequest,
    Whiteboard,
    WhiteboardElement,
    WhiteboardCursorClientMessage,
    WhiteboardCursorPresence,
    WhiteboardCursorSocketState,
    WhiteboardEventsSocketState,
} from './whiteboard.types'
import {
    applyWhiteboardEventToElementsCache,
    createWhiteboardMutationHeaders,
    isSelfOriginatedWhiteboardEvent,
    parseWhiteboardEventMessage,
} from './whiteboard.ws'

const transformWhiteboard = (whiteboard: ApiWhiteboard): Whiteboard => ({
    id: whiteboard.id,
    projectId: whiteboard.projectId,
    createdAt: whiteboard.createdAt,
    updatedAt: whiteboard.updatedAt,
})

const transformWhiteboardElement = (
    element: ApiWhiteboardElement,
): WhiteboardElement => ({
    id: element.id,
    whiteboardId: element.whiteboardId,
    createdBy: element.createdBy,
    elementType: element.elementType,
    props: element.props,
    zIndex: element.zIndex,
    createdAt: element.createdAt,
    updatedAt: element.updatedAt,
})

type WhiteboardCursorSocketLifecycleApi = {
    cacheDataLoaded: Promise<unknown>
    cacheEntryRemoved: Promise<void>
    updateCachedData: (
        recipe: (draft: WhiteboardCursorSocketState) => void,
    ) => void
}

type WhiteboardEventsSocketLifecycleApi = {
    cacheDataLoaded: Promise<unknown>
    cacheEntryRemoved: Promise<void>
    dispatch: (action: unknown) => unknown
    updateCachedData: (
        recipe: (draft: WhiteboardEventsSocketState) => void,
    ) => void
}

const activeWhiteboardCursorSockets = new Map<string, WebSocket>()

const createWhiteboardCursorSocketUrl = (projectId: string) =>
    buildApiWebSocketUrl(`/ws/project/${projectId}/whiteboard/cursor`)

const createWhiteboardEventsSocketUrl = (projectId: string) =>
    buildApiWebSocketUrl(`/ws/project/${projectId}/whiteboard`)

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

const createWhiteboardEventsSocketState = (
    projectId: string,
): WhiteboardEventsSocketState => ({
    projectId,
    url: createWhiteboardEventsSocketUrl(projectId),
    status: 'connecting',
    lastMessage: null,
    lastMessageAt: null,
    lastError: null,
})

const whiteboardReconnectDelaysMs = [1000, 2000, 5000] as const

const closeSocketIfActive = (socket: WebSocket | null) => {
    if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING)
    ) {
        socket.close()
    }
}

const getReconnectDelay = (attempt: number) =>
    whiteboardReconnectDelaysMs[
        Math.min(attempt, whiteboardReconnectDelaysMs.length - 1)
    ]

const waitForDelay = (delayMs: number) =>
    new Promise<void>((resolve) => {
        window.setTimeout(resolve, delayMs)
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

    let isCacheEntryRemoved = false

    const cacheEntryRemoved = lifecycleApi.cacheEntryRemoved.then(() => {
        isCacheEntryRemoved = true
    })

    try {
        await lifecycleApi.cacheDataLoaded
    } catch {
        return
    }

    let reconnectAttempt = 0

    while (!isCacheEntryRemoved) {
        let socket: WebSocket | null = new WebSocket(
            createWhiteboardCursorSocketUrl(projectId),
        )
        let settleSocketLifecycle: (() => void) | null = null
        const socketLifecycleSettled = new Promise<void>((resolve) => {
            settleSocketLifecycle = resolve
        })

        const handleOpen = () => {
            activeWhiteboardCursorSockets.set(projectId, socket!)
            lifecycleApi.updateCachedData((draft) => {
                draft.status = 'connected'
                draft.lastError = null
            })
            reconnectAttempt = 0
        }

        const handleMessage = (event: MessageEvent) => {
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

        const handleError = () => {
            lifecycleApi.updateCachedData((draft) => {
                draft.status = 'error'
                draft.lastError =
                    'Failed to establish whiteboard cursor websocket connection'
            })

            if (
                socket &&
                (socket.readyState === WebSocket.OPEN ||
                    socket.readyState === WebSocket.CONNECTING)
            ) {
                socket.close()
            }
        }

        const handleClose = () => {
            if (activeWhiteboardCursorSockets.get(projectId) === socket) {
                activeWhiteboardCursorSockets.delete(projectId)
            }

            lifecycleApi.updateCachedData((draft) => {
                if (draft.status !== 'error') {
                    draft.status = 'disconnected'
                }
            })
            settleSocketLifecycle?.()
        }

        socket.addEventListener('open', handleOpen)
        socket.addEventListener('message', handleMessage)
        socket.addEventListener('error', handleError)
        socket.addEventListener('close', handleClose)

        await Promise.race([
            cacheEntryRemoved,
            socketLifecycleSettled,
        ])

        socket.removeEventListener('open', handleOpen)
        socket.removeEventListener('message', handleMessage)
        socket.removeEventListener('error', handleError)
        socket.removeEventListener('close', handleClose)

        if (activeWhiteboardCursorSockets.get(projectId) === socket) {
            activeWhiteboardCursorSockets.delete(projectId)
        }

        closeSocketIfActive(socket)

        socket = null

        if (isCacheEntryRemoved) {
            break
        }

        lifecycleApi.updateCachedData((draft) => {
            draft.status = 'connecting'
        })

        const reconnectDelay = getReconnectDelay(reconnectAttempt)
        reconnectAttempt += 1

        await Promise.race([
            cacheEntryRemoved,
            waitForDelay(reconnectDelay),
        ])
    }
}

const patchWhiteboardElementsCacheFromEvent = (
    projectId: string,
    message: WhiteboardEventsSocketState['lastMessage'],
    lifecycleApi: WhiteboardEventsSocketLifecycleApi,
) => {
    if (!message) {
        return
    }

    lifecycleApi.dispatch(
        whiteboardApi.util.updateQueryData(
            'getProjectWhiteboardElements',
            projectId,
            (draft) =>
                applyWhiteboardEventToElementsCache(
                    draft,
                    message,
                    transformWhiteboardElement,
                ),
        ),
    )
}

const watchWhiteboardEventsSocket = async (
    projectId: string,
    lifecycleApi: WhiteboardEventsSocketLifecycleApi,
) => {
    if (typeof WebSocket === 'undefined') {
        return
    }

    let isCacheEntryRemoved = false
    let hasConnectedOnce = false

    const cacheEntryRemoved = lifecycleApi.cacheEntryRemoved.then(() => {
        isCacheEntryRemoved = true
    })

    try {
        await lifecycleApi.cacheDataLoaded
    } catch {
        return
    }

    let reconnectAttempt = 0

    while (!isCacheEntryRemoved) {
        let socket: WebSocket | null = new WebSocket(
            createWhiteboardEventsSocketUrl(projectId),
        )
        let settleSocketLifecycle: (() => void) | null = null
        const socketLifecycleSettled = new Promise<void>((resolve) => {
            settleSocketLifecycle = resolve
        })

        const handleOpen = () => {
            lifecycleApi.updateCachedData((draft) => {
                draft.status = 'connected'
                draft.lastError = null
            })

            if (hasConnectedOnce) {
                const refetch = lifecycleApi.dispatch(
                    whiteboardApi.endpoints.getProjectWhiteboardElements.initiate(
                        projectId,
                        { forceRefetch: true },
                    ),
                ) as { unsubscribe?: () => void }

                refetch.unsubscribe?.()
            }

            hasConnectedOnce = true
            reconnectAttempt = 0
        }

        const handleMessage = (event: MessageEvent) => {
            if (typeof event.data !== 'string') {
                return
            }

            const message = parseWhiteboardEventMessage(event.data)
            if (!message) {
                lifecycleApi.updateCachedData((draft) => {
                    draft.lastError =
                        'Failed to parse whiteboard events websocket message'
                })
                return
            }

            if (!isSelfOriginatedWhiteboardEvent(message)) {
                patchWhiteboardElementsCacheFromEvent(
                    projectId,
                    message,
                    lifecycleApi,
                )
            }

            lifecycleApi.updateCachedData((draft) => {
                draft.lastMessage = message
                draft.lastMessageAt = new Date().toISOString()
            })
        }

        const handleError = () => {
            lifecycleApi.updateCachedData((draft) => {
                draft.status = 'error'
                draft.lastError =
                    'Failed to establish whiteboard websocket connection'
            })

            if (
                socket &&
                (socket.readyState === WebSocket.OPEN ||
                    socket.readyState === WebSocket.CONNECTING)
            ) {
                socket.close()
            }
        }

        const handleClose = () => {
            lifecycleApi.updateCachedData((draft) => {
                if (draft.status !== 'error') {
                    draft.status = 'disconnected'
                }
            })
            settleSocketLifecycle?.()
        }

        socket.addEventListener('open', handleOpen)
        socket.addEventListener('message', handleMessage)
        socket.addEventListener('error', handleError)
        socket.addEventListener('close', handleClose)

        await Promise.race([
            cacheEntryRemoved,
            socketLifecycleSettled,
        ])

        socket.removeEventListener('open', handleOpen)
        socket.removeEventListener('message', handleMessage)
        socket.removeEventListener('error', handleError)
        socket.removeEventListener('close', handleClose)

        closeSocketIfActive(socket)

        socket = null

        if (isCacheEntryRemoved) {
            break
        }

        lifecycleApi.updateCachedData((draft) => {
            draft.status = 'connecting'
        })

        const reconnectDelay = getReconnectDelay(reconnectAttempt)
        reconnectAttempt += 1

        await Promise.race([
            cacheEntryRemoved,
            waitForDelay(reconnectDelay),
        ])
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
        getProjectWhiteboard: builder.query<Whiteboard, string>({
            query: (projectId) => `/projects/${projectId}/whiteboard`,
            transformResponse: (response: ApiWhiteboard) =>
                transformWhiteboard(response),
            providesTags: (_result, _error, projectId) => [
                { type: 'Whiteboard' as const, id: projectId },
            ],
        }),

        getProjectWhiteboardElements: builder.query<
            WhiteboardElement[],
            string
        >({
            query: (projectId) => `/projects/${projectId}/whiteboard/elements`,
            transformResponse: (response: ApiWhiteboardElement[]) =>
                response.map(transformWhiteboardElement),
            providesTags: (_result, _error, projectId) => [
                { type: 'WhiteboardElement' as const, id: projectId },
            ],
        }),

        createProjectWhiteboardElement: builder.mutation<
            WhiteboardElement,
            { projectId: string; body: CreateWhiteboardElementRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/whiteboard/elements`,
                method: 'POST',
                body,
                headers: createWhiteboardMutationHeaders(),
            }),
            transformResponse: (response: ApiWhiteboardElement) =>
                transformWhiteboardElement(response),
        }),

        updateProjectWhiteboardElement: builder.mutation<
            WhiteboardElement,
            {
                projectId: string
                elementId: string
                body: UpdateWhiteboardElementRequest
            }
        >({
            query: ({ projectId, elementId, body }) => ({
                url: `/projects/${projectId}/whiteboard/elements/${elementId}`,
                method: 'PATCH',
                body,
                headers: createWhiteboardMutationHeaders(),
            }),
            transformResponse: (response: ApiWhiteboardElement) =>
                transformWhiteboardElement(response),
        }),

        deleteProjectWhiteboardElement: builder.mutation<
            void,
            { projectId: string; elementId: string }
        >({
            query: ({ projectId, elementId }) => ({
                url: `/projects/${projectId}/whiteboard/elements/${elementId}`,
                method: 'DELETE',
                headers: createWhiteboardMutationHeaders(),
            }),
        }),

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
        watchWhiteboardEvents: builder.query<
            WhiteboardEventsSocketState,
            string
        >({
            queryFn: (projectId) => ({
                data: createWhiteboardEventsSocketState(projectId),
            }),
            async onCacheEntryAdded(projectId, lifecycleApi) {
                await watchWhiteboardEventsSocket(projectId, lifecycleApi)
            },
        }),
    }),
})

export const {
    useGetProjectWhiteboardQuery,
    useGetProjectWhiteboardElementsQuery,
    useCreateProjectWhiteboardElementMutation,
    useUpdateProjectWhiteboardElementMutation,
    useDeleteProjectWhiteboardElementMutation,
    useWatchWhiteboardCursorQuery,
    useWatchWhiteboardEventsQuery,
} = whiteboardApi
