export type WhiteboardCursorUser = {
    id: string
    name: string
    avatarSmall: string
}

export type WhiteboardCursorPosition = {
    x: number | null
    y: number | null
}

export type WhiteboardCursorPresence = {
    user: WhiteboardCursorUser
    cursor: WhiteboardCursorPosition
}

export type WhiteboardCursorClientMessage = {
    cursor: WhiteboardCursorPosition
}

export type WhiteboardSocketStatus =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error'

export type WhiteboardCursorSocketState = {
    projectId: string
    url: string
    status: WhiteboardSocketStatus
    presence: WhiteboardCursorPresence[]
    lastSnapshotAt: string | null
    lastError: string | null
}
