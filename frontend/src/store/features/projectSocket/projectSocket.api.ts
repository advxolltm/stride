import { baseApi, buildApiWebSocketUrl } from '../../api/base.api'
import { handleProjectWsMessage } from '../../middleware/wsProjectHandlers'
import {
    handleTaskWsMessage,
    type WsListenerApi,
} from '../../middleware/wsTaskHandlers'
import {
    WSMessageEnvelopeSchema,
    type projectSocketSocketState,
    type WSMessage,
} from './projectSocket.types'

const createProjectSocketSocketUrl = (projectId: string) =>
    buildApiWebSocketUrl(`/ws/project/${projectId}/kanban`)

const createprojectSocketSocketState = (
    projectId: string,
): projectSocketSocketState => ({
    projectId,
    url: createProjectSocketSocketUrl(projectId),
    status: 'connecting',
    lastMessage: null,
    lastMessageAt: null,
    lastError: null,
})

export const projectSocketApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        watchProjectSockets: builder.query<projectSocketSocketState, string>({
            queryFn: (projectId) => ({
                data: createprojectSocketSocketState(projectId),
            }),
            async onCacheEntryAdded(
                projectId,
                {
                    cacheDataLoaded,
                    cacheEntryRemoved,
                    dispatch,
                    getState,
                    updateCachedData,
                },
            ) {
                if (typeof WebSocket === 'undefined') {
                    return
                }

                let socket: WebSocket | null = null
                let handleOpen: (() => void) | null = null
                let handleMessage: ((event: MessageEvent) => void) | null = null
                let handleError: (() => void) | null = null
                let handleClose: (() => void) | null = null

                try {
                    await cacheDataLoaded

                    socket = new WebSocket(
                        createProjectSocketSocketUrl(projectId),
                    )

                    handleOpen = () => {
                        updateCachedData((draft) => {
                            draft.status = 'connected'
                            draft.lastError = null
                        })
                    }

                    handleMessage = (event: MessageEvent) => {
                        if (typeof event.data !== 'string') {
                            return
                        }

                        try {
                            const raw = JSON.parse(event.data) as unknown
                            const parsed =
                                WSMessageEnvelopeSchema.safeParse(raw)
                            if (!parsed.success) {
                                return
                            }

                            const message: WSMessage<unknown> = parsed.data

                            updateCachedData((draft) => {
                                draft.lastMessage = message
                                draft.lastMessageAt = new Date().toISOString()
                            })

                            const api: WsListenerApi = {
                                dispatch: dispatch as WsListenerApi['dispatch'],
                                getState,
                            }

                            if (
                                handleTaskWsMessage(
                                    message.type,
                                    message.payload,
                                    projectId,
                                    api,
                                )
                            ) {
                                return
                            }

                            if (
                                handleProjectWsMessage(
                                    message.type,
                                    message.payload,
                                    projectId,
                                    api,
                                )
                            ) {
                                return
                            }
                        } catch {
                            updateCachedData((draft) => {
                                draft.lastError =
                                    'Failed to parse projectSocket websocket message'
                            })
                        }
                    }

                    handleError = () => {
                        updateCachedData((draft) => {
                            draft.status = 'error'
                            draft.lastError =
                                'Failed to establish projectSocket websocket connection'
                        })
                    }

                    handleClose = () => {
                        updateCachedData((draft) => {
                            if (draft.status !== 'error') {
                                draft.status = 'disconnected'
                            }
                        })
                    }

                    socket.addEventListener('open', handleOpen)
                    socket.addEventListener('message', handleMessage)
                    socket.addEventListener('error', handleError)
                    socket.addEventListener('close', handleClose)

                    await cacheEntryRemoved
                } catch {
                    return
                } finally {
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
            },
        }),
    }),
})

export const { useWatchProjectSocketsQuery } = projectSocketApi
