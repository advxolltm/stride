import type { PointerEventHandler } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type {
    WhiteboardCursorClientMessage,
    WhiteboardCursorPresence,
} from '../../../../store/features/whiteboard/whiteboard.types'

export interface WhiteboardCanvasProps {
    elements: readonly ExcalidrawElement[]
    presence?: readonly WhiteboardCursorPresence[]
    viewportStorageKey?: string
    onChange?: (elements: readonly ExcalidrawElement[]) => void
    onPointerUp?: (elements: readonly ExcalidrawElement[]) => void
    onCursorChange?: (message: WhiteboardCursorClientMessage) => void
    onCursorLeave?: PointerEventHandler<HTMLDivElement>
}
