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
