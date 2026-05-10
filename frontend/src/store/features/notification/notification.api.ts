import { baseApi, buildApiWebSocketUrl } from '../../api/base.api'
import {
    markNotificationAsRead,
    removeNotification,
    upsertNotification,
} from './notification.cache'
import { transformNotification } from './notification.mappers'
import {
    NotificationWSMessageType,
    type ApiNotification,
    type Notification,
    type NotificationSocketState,
    type NotificationWSMessage,
    type NotificationWSSnapshotPayload,
} from './notification.types'

const createNotificationSocketUrl = () =>
    buildApiWebSocketUrl('/ws/notifications')

const createNotificationSocketState = (): NotificationSocketState => ({
    url: createNotificationSocketUrl(),
    status: 'connecting',
    lastMessage: null,
    lastMessageAt: null,
    lastError: null,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isApiNotification = (value: unknown): value is ApiNotification =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.edit_type === 'string' &&
    typeof value.object_type === 'string' &&
    typeof value.object_id === 'string' &&
    typeof value.message === 'string' &&
    typeof value.read === 'boolean'

const isApiNotificationList = (value: unknown): value is ApiNotification[] =>
    Array.isArray(value) && value.every(isApiNotification)

const isNotificationSnapshotPayload = (
    value: unknown,
): value is NotificationWSSnapshotPayload =>
    isRecord(value) &&
    isApiNotificationList(value.new) &&
    isApiNotificationList(value.old) &&
    typeof value.new_count === 'number' &&
    typeof value.old_count === 'number'

const patchNotification = (
    dispatch: (action: unknown) => unknown,
    notification: Notification,
) => {
    dispatch(
        notificationApi.util.updateQueryData(
            'getNotifications',
            undefined,
            (draft) => {
                upsertNotification(draft, notification)
            },
        ),
    )
}

const replaceNotifications = (
    dispatch: (action: unknown) => unknown,
    notifications: Notification[],
) => {
    dispatch(
        notificationApi.util.upsertQueryData(
            'getNotifications',
            undefined,
            notifications,
        ),
    )
}

const handleNotificationWSMessage = (
    message: NotificationWSMessage<unknown>,
    dispatch: (action: unknown) => unknown,
) => {
    switch (message.type) {
        case NotificationWSMessageType.Snapshot: {
            if (!isNotificationSnapshotPayload(message.payload)) {
                return false
            }

            replaceNotifications(dispatch, [
                ...message.payload.new.map(transformNotification),
                ...message.payload.old.map(transformNotification),
            ])
            return true
        }
        case NotificationWSMessageType.New:
        case NotificationWSMessageType.Old: {
            if (!isApiNotification(message.payload)) {
                return false
            }

            patchNotification(dispatch, transformNotification(message.payload))
            return true
        }
        default:
            return false
    }
}

export const notificationApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getNotifications: builder.query<Notification[], void>({
            query: () => '/notifications',
            transformResponse: (response: ApiNotification[]) =>
                response.map(transformNotification),
            providesTags: [{ type: 'Notification' as const, id: 'LIST' }],
        }),

        markNotificationRead: builder.mutation<void, string>({
            query: (notificationId) => ({
                url: `/notifications/${notificationId}/read`,
                method: 'PATCH',
            }),
            async onQueryStarted(notificationId, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    notificationApi.util.updateQueryData(
                        'getNotifications',
                        undefined,
                        (draft) => {
                            markNotificationAsRead(draft, notificationId)
                        },
                    ),
                )

                try {
                    await queryFulfilled
                } catch {
                    patch.undo()
                }
            },
        }),

        deleteNotification: builder.mutation<void, string>({
            query: (notificationId) => ({
                url: `/notifications/${notificationId}`,
                method: 'DELETE',
            }),
            async onQueryStarted(notificationId, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    notificationApi.util.updateQueryData(
                        'getNotifications',
                        undefined,
                        (draft) => removeNotification(draft, notificationId),
                    ),
                )

                try {
                    await queryFulfilled
                } catch {
                    patch.undo()
                }
            },
        }),

        watchNotifications: builder.query<NotificationSocketState, void>({
            queryFn: () => ({
                data: createNotificationSocketState(),
            }),
            async onCacheEntryAdded(
                _arg,
                {
                    cacheDataLoaded,
                    cacheEntryRemoved,
                    dispatch,
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

                    socket = new WebSocket(createNotificationSocketUrl())

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
                            const parsed = JSON.parse(event.data) as Partial<
                                NotificationWSMessage<unknown>
                            >

                            if (!('type' in parsed) || !('payload' in parsed)) {
                                return
                            }

                            const message =
                                parsed as NotificationWSMessage<unknown>

                            updateCachedData((draft) => {
                                draft.lastMessage = message
                                draft.lastMessageAt = new Date().toISOString()
                            })

                            handleNotificationWSMessage(message, dispatch)
                        } catch {
                            updateCachedData((draft) => {
                                draft.lastError =
                                    'Failed to parse notification websocket message'
                            })
                        }
                    }

                    handleError = () => {
                        updateCachedData((draft) => {
                            draft.status = 'error'
                            draft.lastError =
                                'Failed to establish notification websocket connection'
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

export const {
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
    useDeleteNotificationMutation,
    useWatchNotificationsQuery,
} = notificationApi
