import type { PointerEventHandler } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export interface WhiteboardCanvasProps {
    elements: readonly ExcalidrawElement[]
    viewportStorageKey?: string
    onChange?: (elements: readonly ExcalidrawElement[]) => void
    onPointerUp?: (elements: readonly ExcalidrawElement[]) => void
    onPointerMove?: PointerEventHandler<HTMLDivElement>
    onPointerLeave?: PointerEventHandler<HTMLDivElement>
}
