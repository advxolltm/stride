export const WSMessageType = {
    ChatMessageCreate: 0,
    TaskCreate: 1,
    TaskUpdate: 2,
    TaskDelete: 3,
    TaskMove: 4,
    TaskAssign: 5,
    TaskUnassign: 6,
    ProjectMemberAdd: 7,
    ProjectMemberRemove: 8,
} as const

export type WSMessageType = (typeof WSMessageType)[keyof typeof WSMessageType]

export type WSMessage<T> = {
    type: WSMessageType
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
