import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import './WhiteboardCanvas.css'

import type { WhiteboardCanvasProps } from './types'

export function WhiteboardCanvas({ elements }: WhiteboardCanvasProps) {
    return (
        <div className="whiteboard-excalidraw h-full w-full overflow-hidden">
            <Excalidraw initialData={{ elements }} />
        </div>
    )
}
