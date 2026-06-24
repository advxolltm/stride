import { z } from 'zod'

export const MessageSchema = z.object({
    id: z.string(),
    senderId: z.string().nullable(),
    projectId: z.string(),
    content: z.string(),
    isEdited: z.boolean(),
    isDeleted: z.boolean(),
    createdAt: z.string(),
    editedAt: z.string().nullable(),
    deletedAt: z.string().nullable(),
})

export type Message = z.infer<typeof MessageSchema>

export const MessageCountSchema = z.object({
    count: z.number(),
})

export type MessageCount = z.infer<typeof MessageCountSchema>

export const SendMessageRequestSchema = z.object({
    content: z.string(),
})

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>

export const EditMessageRequestSchema = z.object({
    content: z.string(),
})

export type EditMessageRequest = z.infer<typeof EditMessageRequestSchema>

export const ChatMemberCursorSchema = z.object({
    projectId: z.string(),
    projectMemberId: z.string(),
    lastDeliveredMessageId: z.string(),
    lastDeliveredMessageCreatedAt: z.string(),
    deliveredAt: z.string(),
    lastReadMessageId: z.string().nullable(),
    lastReadMessageCreatedAt: z.string().nullable(),
    readAt: z.string().nullable(),
    updatedAt: z.string(),
})

export type ChatMemberCursor = z.infer<typeof ChatMemberCursorSchema>

export const MarkChatCursorRequestSchema = z.object({
    messageId: z.string(),
})

export type MarkChatCursorRequest = z.infer<
    typeof MarkChatCursorRequestSchema
>

export const createPaginatedSchema = <
    TItemSchema extends z.ZodTypeAny,
>(itemSchema: TItemSchema) =>
    z.object({
        items: z.array(itemSchema),
        page: z.number(),
        pageSize: z.number(),
        pageCount: z.number(),
        totalItemCount: z.number(),
    })

export type Paginated<T> = {
    items: T[]
    page: number
    pageSize: number
    pageCount: number
    totalItemCount: number
}
