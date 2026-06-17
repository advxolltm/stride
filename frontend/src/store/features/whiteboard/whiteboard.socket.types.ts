import {
    WSMessageMetaSchema,
    WSMessageType,
    type WSMessageMeta,
} from '../realtime/realtime.types'
import type { ApiWhiteboardElement } from './whiteboard.api.types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { z } from 'zod'
import { ApiWhiteboardElementSchema } from './whiteboard.api.types'

const ExcalidrawElementSchema = z.custom<ExcalidrawElement>()

export const WhiteboardCursorUserSchema = z.object({
    id: z.string(),
    name: z.string(),
    avatarSmall: z.string(),
})

export type WhiteboardCursorUser = z.infer<typeof WhiteboardCursorUserSchema>

export const WhiteboardCursorPositionSchema = z.object({
    x: z.number().nullable(),
    y: z.number().nullable(),
})

export type WhiteboardCursorPosition = z.infer<
    typeof WhiteboardCursorPositionSchema
>

export const WhiteboardCursorPresenceSchema = z.object({
    user: WhiteboardCursorUserSchema,
    cursor: WhiteboardCursorPositionSchema,
})

export type WhiteboardCursorPresence = z.infer<
    typeof WhiteboardCursorPresenceSchema
>
export const WhiteboardCursorPresenceListSchema = z.array(
    WhiteboardCursorPresenceSchema,
)

export const WhiteboardCursorClientMessageSchema = z.object({
    cursor: WhiteboardCursorPositionSchema,
})

export type WhiteboardCursorClientMessage = z.infer<
    typeof WhiteboardCursorClientMessageSchema
>

export const WhiteboardDeleteEventPayloadSchema = z.object({
    elementId: z.string(),
})

export type WhiteboardDeleteEventPayload = z.infer<
    typeof WhiteboardDeleteEventPayloadSchema
>

export const WhiteboardLiveUpdateEventPayloadSchema = z.object({
    elementId: z.string(),
    elementType: z.string(),
    props: ExcalidrawElementSchema,
    zIndex: z.number(),
})

export type WhiteboardLiveUpdateEventPayload = z.infer<
    typeof WhiteboardLiveUpdateEventPayloadSchema
>

export const WhiteboardLiveClearEventPayloadSchema = z.object({
    elementId: z.string(),
})

export type WhiteboardLiveClearEventPayload = z.infer<
    typeof WhiteboardLiveClearEventPayloadSchema
>

export const WhiteboardSelectionEventPayloadSchema = z.object({
    elementIds: z.array(z.string()),
})

export type WhiteboardSelectionEventPayload = z.infer<
    typeof WhiteboardSelectionEventPayloadSchema
>

export type WhiteboardLiveClientMessageMeta = {
    clientId: string
    operationId?: string
}

export const WhiteboardLiveClientMessageMetaSchema = z.object({
    clientId: z.string(),
    operationId: z.string().optional(),
})

export type WhiteboardLiveUpdateClientMessage = {
    type: typeof WSMessageType.WhiteboardElementLiveUpdate
    meta: WhiteboardLiveClientMessageMeta
    payload: WhiteboardLiveUpdateEventPayload
}

export type WhiteboardLiveClearClientMessage = {
    type: typeof WSMessageType.WhiteboardElementLiveClear
    meta: WhiteboardLiveClientMessageMeta
    payload: WhiteboardLiveClearEventPayload
}

export type WhiteboardSelectionClientMessage = {
    type: typeof WSMessageType.WhiteboardElementSelectionUpdate
    meta: WhiteboardLiveClientMessageMeta
    payload: WhiteboardSelectionEventPayload
}

export type WhiteboardLiveClientMessage =
    | WhiteboardLiveUpdateClientMessage
    | WhiteboardLiveClearClientMessage
    | WhiteboardSelectionClientMessage

export type WhiteboardCreateEventMessage = {
    type: typeof WSMessageType.WhiteboardElementCreate
    meta?: WSMessageMeta
    payload: ApiWhiteboardElement
}

export type WhiteboardUpdateEventMessage = {
    type: typeof WSMessageType.WhiteboardElementUpdate
    meta?: WSMessageMeta
    payload: ApiWhiteboardElement
}

export type WhiteboardDeleteEventMessage = {
    type: typeof WSMessageType.WhiteboardElementDelete
    meta?: WSMessageMeta
    payload: WhiteboardDeleteEventPayload
}

export type WhiteboardLiveUpdateEventMessage = {
    type: typeof WSMessageType.WhiteboardElementLiveUpdate
    meta?: WSMessageMeta
    payload: WhiteboardLiveUpdateEventPayload
}

export type WhiteboardLiveClearEventMessage = {
    type: typeof WSMessageType.WhiteboardElementLiveClear
    meta?: WSMessageMeta
    payload: WhiteboardLiveClearEventPayload
}

export type WhiteboardSelectionEventMessage = {
    type: typeof WSMessageType.WhiteboardElementSelectionUpdate
    meta?: WSMessageMeta
    payload: WhiteboardSelectionEventPayload
}

export type WhiteboardEventMessage =
    | WhiteboardCreateEventMessage
    | WhiteboardUpdateEventMessage
    | WhiteboardDeleteEventMessage

export type WhiteboardLiveEventMessage =
    | WhiteboardLiveUpdateEventMessage
    | WhiteboardLiveClearEventMessage
    | WhiteboardSelectionEventMessage

export type WhiteboardSocketEventMessage =
    | WhiteboardEventMessage
    | WhiteboardLiveEventMessage

export const WhiteboardSocketEventMessageSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal(WSMessageType.WhiteboardElementCreate),
        meta: WSMessageMetaSchema.optional(),
        payload: ApiWhiteboardElementSchema,
    }),
    z.object({
        type: z.literal(WSMessageType.WhiteboardElementUpdate),
        meta: WSMessageMetaSchema.optional(),
        payload: ApiWhiteboardElementSchema,
    }),
    z.object({
        type: z.literal(WSMessageType.WhiteboardElementDelete),
        meta: WSMessageMetaSchema.optional(),
        payload: WhiteboardDeleteEventPayloadSchema,
    }),
    z.object({
        type: z.literal(WSMessageType.WhiteboardElementLiveUpdate),
        meta: WSMessageMetaSchema.optional(),
        payload: WhiteboardLiveUpdateEventPayloadSchema,
    }),
    z.object({
        type: z.literal(WSMessageType.WhiteboardElementLiveClear),
        meta: WSMessageMetaSchema.optional(),
        payload: WhiteboardLiveClearEventPayloadSchema,
    }),
    z.object({
        type: z.literal(WSMessageType.WhiteboardElementSelectionUpdate),
        meta: WSMessageMetaSchema.optional(),
        payload: WhiteboardSelectionEventPayloadSchema,
    }),
])
