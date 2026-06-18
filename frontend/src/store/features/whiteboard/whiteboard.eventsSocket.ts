import { buildApiWebSocketUrl } from '../../api/base.api'
import { watchManagedSocket } from '../realtime/realtime.socketRuntime'
import { WSMessageType } from '../realtime/realtime.types'
import {
    createWhiteboardLiveClientMessageMeta,
    isSelfOriginatedWhiteboardEvent,
} from './whiteboard.client'
import {
    parseWhiteboardEventMessage,
    serializeWhiteboardLiveClientMessage,
} from './whiteboard.protocol'
import { isPersistedWhiteboardEventMessage } from './whiteboard.cache'
import type {
    WhiteboardEventMessage,
    WhiteboardLiveClientMessage,
    WhiteboardLiveUpdateEventPayload,
    WhiteboardSelectionEventPayload,
    WhiteboardSocketEventMessage,
} from './whiteboard.socket.types'
import type { WhiteboardEventsSocketState } from './whiteboard.ui.types'

export type WhiteboardEventsSocketLifecycleApi = {
    cacheDataLoaded: Promise<unknown>
    cacheEntryRemoved: Promise<void>
    updateCachedData: (
        recipe: (draft: WhiteboardEventsSocketState) => void,
    ) => void
}

type WhiteboardEventsSocketHandlers = {
    invalidateElementsCache: () => void
    patchElementsCacheFromEvent: (message: WhiteboardEventMessage) => void
    patchLiveOverlayFromEvent: (message: WhiteboardSocketEventMessage) => void
}

const activeWhiteboardEventSockets = new Map<string, WebSocket>()

const createWhiteboardEventsSocketUrl = (projectId: string) =>
    buildApiWebSocketUrl(`/ws/project/${projectId}/whiteboard`)

export const createWhiteboardEventsSocketState = (
    projectId: string,
): WhiteboardEventsSocketState => ({
    projectId,
    url: createWhiteboardEventsSocketUrl(projectId),
    status: 'connecting',
    liveElementsById: {},
    remoteSelectionClientIdsByElementId: {},
    lastMessage: null,
    lastMessageAt: null,
    lastError: null,
})

export const watchWhiteboardEventsSocket = async (
    projectId: string,
    lifecycleApi: WhiteboardEventsSocketLifecycleApi,
    handlers: WhiteboardEventsSocketHandlers,
) => {
    await watchManagedSocket({
        cacheDataLoaded: lifecycleApi.cacheDataLoaded,
        cacheEntryRemoved: lifecycleApi.cacheEntryRemoved,
        createSocket: () =>
            new WebSocket(createWhiteboardEventsSocketUrl(projectId)),
        createSocketEventHandlers: (socket, controls) => ({
            open: () => {
                activeWhiteboardEventSockets.set(projectId, socket)
                lifecycleApi.updateCachedData((draft) => {
                    draft.status = 'connected'
                    draft.lastError = null
                })
            },
            message: (event) => {
                if (typeof event.data !== 'string') {
                    return
                }

                const message = parseWhiteboardEventMessage(event.data)
                if (!message) {
                    controls.reportParseError(
                        'Failed to parse whiteboard events websocket message',
                    )
                    lifecycleApi.updateCachedData((draft) => {
                        draft.lastError =
                            'Failed to parse whiteboard events websocket message'
                    })
                    return
                }

                const isPersistedEvent =
                    isPersistedWhiteboardEventMessage(message)
                const isSelfOriginated =
                    isSelfOriginatedWhiteboardEvent(message)

                if (isSelfOriginated && !isPersistedEvent) {
                    return
                }

                if (!isSelfOriginated) {
                    handlers.patchLiveOverlayFromEvent(message)
                }

                if (!isSelfOriginated && isPersistedEvent) {
                    handlers.patchElementsCacheFromEvent(message)
                }

                lifecycleApi.updateCachedData((draft) => {
                    draft.lastMessage = message
                    draft.lastMessageAt = new Date().toISOString()
                })
            },
            error: () => {
                lifecycleApi.updateCachedData((draft) => {
                    draft.status = 'error'
                    draft.lastError =
                        'Failed to establish whiteboard websocket connection'
                })
            },
            close: () => {
                activeWhiteboardEventSockets.delete(projectId)
                lifecycleApi.updateCachedData((draft) => {
                    if (draft.status !== 'error') {
                        draft.status = 'disconnected'
                    }
                })
            },
        }),
        onFinally: () => {
            activeWhiteboardEventSockets.delete(projectId)
        },
        onParseError: () => {
            handlers.invalidateElementsCache()
        },
        onReconnect: () => {
            handlers.invalidateElementsCache()
        },
    })
}

export const sendWhiteboardLiveMessage = (
    projectId: string,
    message: WhiteboardLiveClientMessage,
) => {
    const socket = activeWhiteboardEventSockets.get(projectId)
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false
    }

    socket.send(serializeWhiteboardLiveClientMessage(message))
    return true
}

export const sendWhiteboardLiveUpdate = (
    projectId: string,
    payload: WhiteboardLiveUpdateEventPayload,
) =>
    sendWhiteboardLiveMessage(projectId, {
        type: WSMessageType.WhiteboardElementLiveUpdate,
        meta: createWhiteboardLiveClientMessageMeta(),
        payload,
    })

export const sendWhiteboardLiveClear = (projectId: string, elementId: string) =>
    sendWhiteboardLiveMessage(projectId, {
        type: WSMessageType.WhiteboardElementLiveClear,
        meta: createWhiteboardLiveClientMessageMeta(),
        payload: { elementId },
    })

export const sendWhiteboardSelectionUpdate = (
    projectId: string,
    payload: WhiteboardSelectionEventPayload,
) =>
    sendWhiteboardLiveMessage(projectId, {
        type: WSMessageType.WhiteboardElementSelectionUpdate,
        meta: createWhiteboardLiveClientMessageMeta(),
        payload,
    })
