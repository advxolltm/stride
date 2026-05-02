export type Message = {
    id: string
    senderId: string | null
    projectId: string
    content: string
    isEdited: boolean
    isDeleted: boolean
    createdAt: string
    editedAt: string | null
    deletedAt: string | null
}


export type MessageCount = {
    count: number
}
