import { z } from 'zod'

export const ApiNotificationSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    edit_type: z.string(),
    object_type: z.string(),
    object_id: z.string(),
    message: z.string(),
    read: z.boolean(),
})

export type ApiNotification = z.infer<typeof ApiNotificationSchema>

export const ApiNotificationListSchema = z.array(ApiNotificationSchema)

export const NotificationSchema = z.object({
    id: z.string(),
    userId: z.string(),
    editType: z.string(),
    objectType: z.string(),
    objectId: z.string(),
    message: z.string(),
    read: z.boolean(),
})

export type Notification = z.infer<typeof NotificationSchema>

export const NotificationWSMessageType = {
    Snapshot: 'notifications.snapshot',
    New: 'notifications.new',
    Old: 'notifications.old',
} as const

export type NotificationWSMessageType =
    (typeof NotificationWSMessageType)[keyof typeof NotificationWSMessageType]

export const NotificationWSMessageTypeSchema = z.enum([
    NotificationWSMessageType.Snapshot,
    NotificationWSMessageType.New,
    NotificationWSMessageType.Old,
])

export type NotificationWSMessage<T> = {
    type: NotificationWSMessageType
    payload: T
}

export const NotificationWSMessageEnvelopeSchema = z.object({
    type: NotificationWSMessageTypeSchema,
    payload: z.unknown(),
})

export const NotificationWSSnapshotPayloadSchema = z.object({
    new: ApiNotificationListSchema,
    old: ApiNotificationListSchema,
    new_count: z.number(),
    old_count: z.number(),
})

export type NotificationWSSnapshotPayload = z.infer<
    typeof NotificationWSSnapshotPayloadSchema
>

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
