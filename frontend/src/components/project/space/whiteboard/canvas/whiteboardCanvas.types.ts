import type {
    NonDeletedExcalidrawElement,
    Ordered,
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
    focusTarget?: WhiteboardFocusTarget | null
    presence?: readonly WhiteboardCursorPresence[]
    remoteSelectionClientIdsByElementId?: Record<string, string[]>
    viewportStorageKey?: string
    viewModeEnabled?: boolean
	taskPreviewModeEnabled?: boolean
    onChange?: (elements: readonly OrderedExcalidrawElement[]) => void
    onPointerUp?: (elements: readonly OrderedExcalidrawElement[]) => void
    onCursorChange?: (message: WhiteboardCursorClientMessage) => void
    onSelectionChange?: (elementIds: readonly string[]) => boolean | void
	onElementsSelectedChanged?: (elements: readonly Ordered<NonDeletedExcalidrawElement>[], groupedElements: readonly Ordered<NonDeletedExcalidrawElement>[], selectedOuterGroupIds: readonly string[]) => void
	onLinkTaskRename?: (taskId: string, newTitle: string) => Promise<void>
}
