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

export type SendMessageRequest = {
	content: string	
}

export type EditMessageRequest = {
	content: string
}

export type Paginated<T> = {
	items: T[]
	page: number
	pageSize: number
	pageCount: number
	totalItemCount: number
}

