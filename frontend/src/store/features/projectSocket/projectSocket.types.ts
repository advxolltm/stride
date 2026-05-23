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
    WhiteboardElementCreate: 15,
    WhiteboardElementUpdate: 16,
    WhiteboardElementDelete: 17,
    WhiteboardElementLiveUpdate: 18,
    WhiteboardElementLiveClear: 19,
    WhiteboardElementRollback: 20,
} as const

export type WSMessageType = (typeof WSMessageType)[keyof typeof WSMessageType]

export type WSMessageMeta = {
    projectId: string
    originUserId?: string
    clientId?: string
    operationId?: string
    sentAt: string
}

export type WSMessage<T> = {
    type: WSMessageType
    meta?: WSMessageMeta
    payload: T
}

export type projectSocketStatus =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error'

export type projectSocketSocketState = {
    projectId: string
    url: string
    status: projectSocketStatus
    lastMessage: WSMessage<unknown> | null
    lastMessageAt: string | null
    lastError: string | null
}
