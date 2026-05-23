import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export type ApiWhiteboard = {
    id: string
    projectId: string
    createdAt: string
    updatedAt: string
}

export type ApiWhiteboardElement = {
    id: string
    whiteboardId: string
    createdBy: string | null
    elementType: string
    props: ExcalidrawElement
    zIndex: number
    createdAt: string
    updatedAt: string
}

export type Whiteboard = {
    id: string
    projectId: string
    createdAt: string
    updatedAt: string
}

export type WhiteboardElement = {
    id: string
    whiteboardId: string
    createdBy: string | null
    elementType: string
    props: ExcalidrawElement
    zIndex: number
    createdAt: string
    updatedAt: string
}

export type CreateWhiteboardElementRequest = {
    elementType: string
    props: ExcalidrawElement
    zIndex: number
}

export type UpdateWhiteboardElementRequest = {
    elementType?: string
    props?: ExcalidrawElement
    zIndex?: number
}
