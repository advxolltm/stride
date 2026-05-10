export const WSMessageType = {
    ChatMessageCreate: 0,
    TaskCreate: 1,
    TaskUpdate: 2,
    TaskDelete: 3,
    TaskMove: 4,
    TaskAssign: 5,
    TaskUnassign: 6,
    TaskSkillAdded: 7,
    TaskSkillRemoved: 8,
    ProjectMemberAdd: 9,
    ProjectMemberRemove: 10,
    ProjectSkillAdd: 11,
    ProjectSkillRemove: 12,
    WhiteboardElementCreate: 13,
    WhiteboardElementUpdate: 14,
    WhiteboardElementDelete: 15,
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
