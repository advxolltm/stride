import { baseApi, buildApiWebSocketUrl } from '../../api/base.api'
import { handleProjectWsMessage } from '../../middleware/wsProjectHandlers'
import {
    handleTaskWsMessage,
    type WsListenerApi,
} from '../../middleware/wsTaskHandlers'
import { watchManagedSocket } from '../realtime/realtime.socketRuntime'
import type {
    RealtimeSocketStatus,
    WSMessage,
} from '../realtime/realtime.types'

export type TasksSocketState = {
    projectId: string
    url: string
    status: RealtimeSocketStatus
    lastMessage: WSMessage<unknown> | null
    lastMessageAt: string | null
    lastError: string | null
}

export const createProjectTasksSocketUrl = (projectId: string) =>
    buildApiWebSocketUrl(`/ws/project/${projectId}/tasks`)

export const createProjectTasksSocketState = (
    projectId: string,
): TasksSocketState => ({
    projectId,
    url: createProjectTasksSocketUrl(projectId),
    status: 'connecting',
    lastMessage: null,
    lastMessageAt: null,
    lastError: null,
})

export const invalidateProjectTasks = (
    api: Pick<WsListenerApi, 'dispatch'>,
    projectId: string,
) => {
    api.dispatch(baseApi.util.invalidateTags([{ type: 'Task', id: projectId }]))
}

const parseTasksSocketMessage = (rawMessage: string) => {
    try {
        const parsed = JSON.parse(rawMessage) as Partial<WSMessage<unknown>>
        if (typeof parsed.type !== 'number' || !('payload' in parsed)) {
            return null
        }

        return parsed as WSMessage<unknown>
    } catch {
        return null
    }
}

export const taskSocketApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        watchProjectTasksSocket: builder.query<TasksSocketState, string>({
            keepUnusedDataFor: 0,
            queryFn: (projectId) => ({
                data: createProjectTasksSocketState(projectId),
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
                await watchManagedSocket({
                    cacheDataLoaded,
                    cacheEntryRemoved,
                    createSocket: () =>
                        new WebSocket(createProjectTasksSocketUrl(projectId)),
                    createSocketEventHandlers: (_socket, controls) => ({
                        open: () => {
                            updateCachedData((draft) => {
                                draft.status = 'connected'
                                draft.lastError = null
                            })
                        },
                        message: (event) => {
                            if (typeof event.data !== 'string') {
                                return
                            }

                            const message = parseTasksSocketMessage(event.data)
                            if (!message) {
                                controls.reportParseError(
                                    'Failed to parse tasks websocket message',
                                )
                                updateCachedData((draft) => {
                                    draft.status = 'error'
                                    draft.lastError =
                                        'Failed to parse tasks websocket message'
                                })
                                return
                            }

                            updateCachedData((draft) => {
                                draft.lastMessage = message
                                draft.lastMessageAt = new Date().toISOString()
                                draft.lastError = null
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

                            handleProjectWsMessage(
                                message.type,
                                message.payload,
                                projectId,
                                api,
                            )
                        },
                        error: () => {
                            updateCachedData((draft) => {
                                draft.status = 'error'
                                draft.lastError =
                                    'Failed to establish tasks websocket connection'
                            })
                        },
                        close: () => {
                            updateCachedData((draft) => {
                                if (draft.status !== 'error') {
                                    draft.status = 'disconnected'
                                }
                            })
                        },
                    }),
                    onOpen: () => {
                        invalidateProjectTasks({ dispatch }, projectId)
                    },
                    onParseError: () => {
                        invalidateProjectTasks({ dispatch }, projectId)
                    },
                })
            },
        }),
    }),
})

export const { useWatchProjectTasksSocketQuery } = taskSocketApi
