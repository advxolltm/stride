import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import './WhiteboardCanvas.css'

import type { WhiteboardCanvasProps } from './types'

export function WhiteboardCanvas({ projectId }: WhiteboardCanvasProps) {
    return (
        <div
            className="whiteboard-excalidraw h-screen w-full overflow-hidden"
            data-project-id={projectId}
        >
            <Excalidraw />
        </div>
    )
}
