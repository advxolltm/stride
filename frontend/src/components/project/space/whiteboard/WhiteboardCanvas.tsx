import { useEffect, useMemo, useRef } from 'react'
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw'
import type {
    ExcalidrawImperativeAPI,
    AppState,
} from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import './WhiteboardCanvas.css'

import type { WhiteboardCanvasProps } from './types'

interface PersistedViewport {
    scrollX: number
    scrollY: number
    zoom: number
}

const readPersistedViewport = (
    storageKey?: string,
): PersistedViewport | undefined => {
    if (!storageKey || typeof window === 'undefined') {
        return undefined
    }

    try {
        const rawViewport = window.localStorage.getItem(storageKey)
        if (!rawViewport) {
            return undefined
        }

        const parsedViewport = JSON.parse(rawViewport) as Partial<PersistedViewport>
        if (
            typeof parsedViewport.scrollX !== 'number' ||
            typeof parsedViewport.scrollY !== 'number' ||
            typeof parsedViewport.zoom !== 'number'
        ) {
            return undefined
        }

        return parsedViewport as PersistedViewport
    } catch {
        return undefined
    }
}

const persistViewport = (
    storageKey: string | undefined,
    viewport: PersistedViewport,
) => {
    if (!storageKey || typeof window === 'undefined') {
        return
    }

    window.localStorage.setItem(storageKey, JSON.stringify(viewport))
}

const toZoomValue = (zoom: number): AppState['zoom']['value'] =>
    zoom as AppState['zoom']['value']

export function WhiteboardCanvas({
    elements,
    viewportStorageKey,
    onChange,
    onPointerUp,
}: WhiteboardCanvasProps) {
    const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
    const sceneElements = useMemo(
        () => elements.map((element) => ({ ...element })),
        [elements],
    )
    const initialViewport = useMemo(
        () => readPersistedViewport(viewportStorageKey),
        [viewportStorageKey],
    )
    const initialAppState = initialViewport
        ? {
              scrollX: initialViewport.scrollX,
              scrollY: initialViewport.scrollY,
              zoom: { value: toZoomValue(initialViewport.zoom) },
          }
        : undefined

    useEffect(() => {
        excalidrawApiRef.current?.updateScene({
            elements: sceneElements,
            captureUpdate: CaptureUpdateAction.NEVER,
        })
    }, [sceneElements])

    return (
        <div className="whiteboard-excalidraw h-full w-full overflow-hidden">
            <Excalidraw
                initialData={{
                    elements: sceneElements,
                    appState: initialAppState,
                }}
                excalidrawAPI={(api) => {
                    excalidrawApiRef.current = api
                }}
                onChange={onChange}
                onScrollChange={(scrollX, scrollY, zoom) => {
                    persistViewport(viewportStorageKey, {
                        scrollX,
                        scrollY,
                        zoom: zoom.value,
                    })
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
