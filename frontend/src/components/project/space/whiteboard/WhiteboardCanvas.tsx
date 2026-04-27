import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

import type { WhiteboardCanvasProps } from './types'

export function WhiteboardCanvas({ projectId }: WhiteboardCanvasProps) {
    return (
        <div
            className="h-[calc(100vh-5rem)] w-full"
            data-project-id={projectId}
        >
            <Excalidraw />
        </div>
    )
}
