export interface WhiteboardCanvasProps {
    projectId: string
    onDrawingChange?: (isDrawing: boolean) => void
    onUiBlockingChange?: (isBlocking: boolean) => void
}
