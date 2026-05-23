import type { PointerEventHandler } from 'react'
import type {
    OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types'
import type {
    WhiteboardCursorClientMessage,
    WhiteboardCursorPresence,
} from '../../../../../store/features/whiteboard/whiteboard.socket.types'

export interface WhiteboardCanvasProps {
    elements: readonly OrderedExcalidrawElement[]
    presence?: readonly WhiteboardCursorPresence[]
    viewportStorageKey?: string
    onChange?: (elements: readonly OrderedExcalidrawElement[]) => void
    onPointerUp?: (elements: readonly OrderedExcalidrawElement[]) => void
    onCursorChange?: (message: WhiteboardCursorClientMessage) => void
    onCursorLeave?: PointerEventHandler<HTMLDivElement>
}
