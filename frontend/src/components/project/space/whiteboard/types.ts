import type { PointerEventHandler } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { WhiteboardCursorPresence } from '../../../../store/features/whiteboard/whiteboard.types'

export interface WhiteboardCanvasProps {
    elements: readonly ExcalidrawElement[]
    presence?: readonly WhiteboardCursorPresence[]
    viewportStorageKey?: string
    onChange?: (elements: readonly ExcalidrawElement[]) => void
    onPointerUp?: (elements: readonly ExcalidrawElement[]) => void
    onPointerMove?: PointerEventHandler<HTMLDivElement>
    onPointerLeave?: PointerEventHandler<HTMLDivElement>
}
