export type ApiNotification = {
    id: string
    user_id: string
    edit_type: string
    object_type: string
    object_id: string
    message: string
    read: boolean
}

export type Notification = {
    id: string
    userId: string
    editType: string
    objectType: string
    objectId: string
    message: string
    read: boolean
}

export const NotificationWSMessageType = {
    Snapshot: 'notifications.snapshot',
    New: 'notifications.new',
    Old: 'notifications.old',
} as const

export type NotificationWSMessageType =
    (typeof NotificationWSMessageType)[keyof typeof NotificationWSMessageType]

export type NotificationWSMessage<T> = {
    type: NotificationWSMessageType
    payload: T
}

export type NotificationWSSnapshotPayload = {
    new: ApiNotification[]
    old: ApiNotification[]
    new_count: number
    old_count: number
}

export type NotificationSocketStatus =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error'

export type NotificationSocketState = {
    url: string
    status: NotificationSocketStatus
    lastMessage: NotificationWSMessage<unknown> | null
    lastMessageAt: string | null
    lastError: string | null
}
