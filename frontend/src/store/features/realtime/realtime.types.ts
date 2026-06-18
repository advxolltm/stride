import { z } from 'zod'

export const WSMessageType = {
    ChatMessageCreate: 0,
    ChatMessageUpdate: 1,
    ChatMessageDelete: 2,
    TaskCreate: 3,
    TaskUpdate: 4,
    TaskDelete: 5,
    TaskMove: 6,
    TaskAssign: 7,
    TaskUnassign: 8,
    TaskSkillAdded: 9,
    TaskSkillRemoved: 10,
    ProjectMemberAdd: 11,
    ProjectMemberRemove: 12,
    ProjectSkillAdd: 13,
    ProjectSkillRemove: 14,
    ProjectUpdate: 15,
    ProjectDelete: 16,
    WhiteboardElementCreate: 17,
    WhiteboardElementUpdate: 18,
    WhiteboardElementDelete: 19,
    WhiteboardElementLiveUpdate: 20,
    WhiteboardElementLiveClear: 21,
    WhiteboardElementRollback: 22,
    WhiteboardElementSelectionUpdate: 23,
} as const

export type WSMessageType = (typeof WSMessageType)[keyof typeof WSMessageType]

export const WSMessageTypeSchema = z.union([
    z.literal(WSMessageType.ChatMessageCreate),
    z.literal(WSMessageType.ChatMessageUpdate),
    z.literal(WSMessageType.ChatMessageDelete),
    z.literal(WSMessageType.TaskCreate),
    z.literal(WSMessageType.TaskUpdate),
    z.literal(WSMessageType.TaskDelete),
    z.literal(WSMessageType.TaskMove),
    z.literal(WSMessageType.TaskAssign),
    z.literal(WSMessageType.TaskUnassign),
    z.literal(WSMessageType.TaskSkillAdded),
    z.literal(WSMessageType.TaskSkillRemoved),
    z.literal(WSMessageType.ProjectMemberAdd),
    z.literal(WSMessageType.ProjectMemberRemove),
    z.literal(WSMessageType.ProjectSkillAdd),
    z.literal(WSMessageType.ProjectSkillRemove),
    z.literal(WSMessageType.ProjectUpdate),
    z.literal(WSMessageType.ProjectDelete),
    z.literal(WSMessageType.WhiteboardElementCreate),
    z.literal(WSMessageType.WhiteboardElementUpdate),
    z.literal(WSMessageType.WhiteboardElementDelete),
    z.literal(WSMessageType.WhiteboardElementLiveUpdate),
    z.literal(WSMessageType.WhiteboardElementLiveClear),
    z.literal(WSMessageType.WhiteboardElementRollback),
    z.literal(WSMessageType.WhiteboardElementSelectionUpdate),
])

export const WSMessageMetaSchema = z.object({
    projectId: z.string(),
    originUserId: z.string().optional(),
    clientId: z.string().optional(),
    operationId: z.string().optional(),
    sentAt: z.string(),
})

export type WSMessageMeta = z.infer<typeof WSMessageMetaSchema>

export type WSMessage<T> = {
    type: WSMessageType
    meta?: WSMessageMeta
    payload: T
}

export const WSMessageEnvelopeSchema = z.object({
    type: WSMessageTypeSchema,
    meta: WSMessageMetaSchema.optional(),
    payload: z.unknown(),
})

export type RealtimeSocketStatus =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error'
