import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import './WhiteboardCanvas.css'

import type { WhiteboardCanvasProps } from './types'

export function WhiteboardCanvas({
    projectId,
    onDrawingChange,
    onUiBlockingChange,
}: WhiteboardCanvasProps) {
    return (
        <div
            className="whiteboard-excalidraw h-screen w-full overflow-hidden"
            data-project-id={projectId}
        >
            <Excalidraw
                onPointerDown={() => onDrawingChange?.(true)}
                onPointerUp={() => onDrawingChange?.(false)}
                onPointerUpdate={({ button }) =>
                    onDrawingChange?.(button === 'down')
                }
                onChange={(_elements, appState) => {
                    onUiBlockingChange?.(
                        Boolean(appState.openDialog || appState.openSidebar),
                    )
                }}
            />
        </div>
    )
}
