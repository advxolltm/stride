import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export interface WhiteboardCanvasProps {
    elements: readonly ExcalidrawElement[]
    onChange?: (elements: readonly ExcalidrawElement[]) => void
}
