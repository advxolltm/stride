import type { PointerEventHandler } from 'react'
import type {
    OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types'
import type {
    WhiteboardCursorClientMessage,
    WhiteboardCursorPresence,
} from '../../../../../store/features/whiteboard/whiteboard.socket.types'

export type WhiteboardFocusTarget = {
    nonce: number
    x: number
    y: number
}

export interface WhiteboardCanvasProps {
    elements: readonly OrderedExcalidrawElement[]
    presence?: readonly WhiteboardCursorPresence[]
    viewportStorageKey?: string
    viewModeEnabled?: boolean
    onChange?: (elements: readonly OrderedExcalidrawElement[]) => void
    onPointerUp?: (elements: readonly OrderedExcalidrawElement[]) => void
    onCursorChange?: (message: WhiteboardCursorClientMessage) => void
    onCursorLeave?: PointerEventHandler<HTMLDivElement>
}
