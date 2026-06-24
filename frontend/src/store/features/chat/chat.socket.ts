import { baseApi, buildApiWebSocketUrl } from '../../api/base.api'
import { handleProjectWsMessage } from '../../middleware/wsProjectHandlers'
import type { WsListenerApi } from '../../middleware/wsTaskHandlers'
import { watchManagedSocket } from '../realtime/realtime.socketRuntime'
import {
    WSMessageEnvelopeSchema,
    WSMessageType,
    type RealtimeSocketStatus,
    type WSMessage,
} from '../realtime/realtime.types'
import { chatApi } from './chat.api'
import { ChatMemberCursorSchema, type ChatMemberCursor } from './chat.types'

export type ChatSocketState = {
    projectId: string
    url: string
    status: RealtimeSocketStatus
    lastMessage: WSMessage<unknown> | null
    lastMessageAt: string | null
    lastError: string | null
}

export const createProjectChatSocketUrl = (projectId: string) =>
    buildApiWebSocketUrl(`/ws/project/${projectId}/chat`)

export const createProjectChatSocketState = (
    projectId: string,
): ChatSocketState => ({
    projectId,
    url: createProjectChatSocketUrl(projectId),
    status: 'connecting',
    lastMessage: null,
    lastMessageAt: null,
    lastError: null,
})

export const invalidateProjectMessages = (
    api: Pick<WsListenerApi, 'dispatch'>,
    projectId: string,
) => {
    api.dispatch(
        baseApi.util.invalidateTags([{ type: 'Messages', id: projectId }]),
    )
}

const upsertProjectChatCursor = (
    api: Pick<WsListenerApi, 'dispatch'>,
    projectId: string,
    cursor: ChatMemberCursor,
) => {
    api.dispatch(
        chatApi.util.updateQueryData(
            'getChatMemberCursors',
            { projectId },
            (draft) => {
                const index = draft.findIndex(
                    (item) => item.projectMemberId === cursor.projectMemberId,
                )

                if (index === -1) {
                    draft.push(cursor)
                    return
                }

                draft[index] = cursor
            },
        ),
    )
}

const invalidateProjectChatCursors = (
    api: Pick<WsListenerApi, 'dispatch'>,
    projectId: string,
) => {
    api.dispatch(
        baseApi.util.invalidateTags([
            { type: 'ChatMemberCursor', id: projectId },
        ]),
    )
}

const isChatWsMessageType = (type: number) =>
    type === WSMessageType.ChatMessageCreate ||
    type === WSMessageType.ChatMessageUpdate ||
    type === WSMessageType.ChatMessageDelete

export const handleChatWsMessage = (
    type: number,
    _payload: unknown,
    projectId: string,
    api: Pick<WsListenerApi, 'dispatch'>,
) => {
    if (type === WSMessageType.ChatMemberCursorUpdate) {
        const parsedPayload = ChatMemberCursorSchema.safeParse(_payload)

        if (parsedPayload.success) {
            upsertProjectChatCursor(api, projectId, parsedPayload.data)
            invalidateProjectChatCursors(api, projectId)
        } else {
            invalidateProjectChatCursors(api, projectId)
        }

        return true
    }

    if (!isChatWsMessageType(type)) {
        return false
    }

    invalidateProjectMessages(api, projectId)
    return true
}

const parseChatSocketMessage = (rawMessage: string) => {
    try {
        const parsed = WSMessageEnvelopeSchema.safeParse(
            JSON.parse(rawMessage) as unknown,
        )
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

export const chatSocketApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        watchProjectChatSocket: builder.query<ChatSocketState, string>({
            keepUnusedDataFor: 0,
            queryFn: (projectId) => ({
                data: createProjectChatSocketState(projectId),
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
                        new WebSocket(createProjectChatSocketUrl(projectId)),
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

                            const message = parseChatSocketMessage(event.data)
                            if (!message) {
                                controls.reportParseError(
                                    'Failed to parse chat websocket message',
                                )
                                updateCachedData((draft) => {
                                    draft.status = 'error'
                                    draft.lastError =
                                        'Failed to parse chat websocket message'
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
                                handleChatWsMessage(
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
                                    'Failed to establish chat websocket connection'
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
                        invalidateProjectMessages({ dispatch }, projectId)
                    },
                    onParseError: () => {
                        invalidateProjectMessages({ dispatch }, projectId)
                    },
                })
            },
        }),
    }),
})

export const { useWatchProjectChatSocketQuery } = chatSocketApi
