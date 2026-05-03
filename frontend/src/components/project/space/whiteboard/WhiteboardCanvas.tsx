import { useEffect, useMemo, useRef } from 'react'
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import './WhiteboardCanvas.css'

import type { WhiteboardCanvasProps } from './types'

export function WhiteboardCanvas({
    elements,
    onPointerUp,
}: WhiteboardCanvasProps) {
    const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
    const sceneElements = useMemo(
        () => elements.map((element) => ({ ...element })),
        [elements],
    )

    useEffect(() => {
        excalidrawApiRef.current?.updateScene({
            elements: sceneElements,
            captureUpdate: CaptureUpdateAction.NEVER,
        })
    }, [sceneElements])

    return (
        <div className="whiteboard-excalidraw h-full w-full overflow-hidden">
            <Excalidraw
                initialData={{ elements: sceneElements }}
                excalidrawAPI={(api) => {
                    excalidrawApiRef.current = api
                }}
                onPointerUp={() => {
                    onPointerUp?.(
                        excalidrawApiRef.current?.getSceneElementsIncludingDeleted() ??
                            [],
                    )
                }}
            />
        </div>
    )
}
