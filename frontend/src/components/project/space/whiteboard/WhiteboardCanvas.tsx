import { useEffect, useMemo, useRef, useState } from 'react'
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw'
import type {
    ExcalidrawImperativeAPI,
    AppState,
} from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import './WhiteboardCanvas.css'

import type { WhiteboardCanvasProps } from './types'
import getInitials from '../../../../shared/utils/getInitials'

const formatCursorLabel = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean)

    if (words.length === 0) {
        return ''
    }

    if (words.length === 1) {
        return words[0]
    }

    const [firstName, lastName] = words
    return `${firstName} ${lastName[0]}.`
}

interface PersistedViewport {
    scrollX: number
    scrollY: number
    zoom: number
}

const defaultViewport: PersistedViewport = {
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
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

const toViewportCoordinates = (
    sceneX: number,
    sceneY: number,
    viewport: PersistedViewport,
) => ({
    x: (sceneX + viewport.scrollX) * viewport.zoom,
    y: (sceneY + viewport.scrollY) * viewport.zoom,
})

export function WhiteboardCanvas({
    elements,
    presence = [],
    viewportStorageKey,
    onChange,
    onPointerUp,
    onCursorChange,
    onCursorLeave,
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
    const [viewport, setViewport] = useState<PersistedViewport>(
        initialViewport ?? defaultViewport,
    )

    useEffect(() => {
        excalidrawApiRef.current?.updateScene({
            elements: sceneElements,
            captureUpdate: CaptureUpdateAction.NEVER,
        })
    }, [sceneElements])

    return (
        <div
            className="whiteboard-excalidraw relative h-full w-full overflow-hidden"
            onPointerLeave={onCursorLeave}
        >
            <Excalidraw
                initialData={{
                    elements: sceneElements,
                    appState: initialAppState,
                }}
                excalidrawAPI={(api) => {
                    excalidrawApiRef.current = api
                }}
                onChange={onChange}
                onPointerUpdate={(payload) => {
                    onCursorChange?.({
                        cursor: {
                            x: payload.pointer.x,
                            y: payload.pointer.y,
                        },
                    })
                }}
                onScrollChange={(scrollX, scrollY, zoom) => {
                    const nextViewport = {
                        scrollX,
                        scrollY,
                        zoom: zoom.value,
                    }

                    setViewport(nextViewport)
                    persistViewport(viewportStorageKey, nextViewport)
                }}
                onPointerUp={() => {
                    onPointerUp?.(
                        excalidrawApiRef.current?.getSceneElementsIncludingDeleted() ??
                            [],
                    )
                }}
            />
            <div className="pointer-events-none absolute inset-0 z-10">
                {presence.map((item) => {
                    if (item.cursor.x === null || item.cursor.y === null) {
                        return null
                    }

                    const cursorPosition = toViewportCoordinates(
                        item.cursor.x,
                        item.cursor.y,
                        viewport,
                    )
                    const label =
                        formatCursorLabel(item.user.name) ||
                        getInitials(item.user.name)

                    return (
                        <div
                            key={item.user.id}
                            className="absolute"
                            style={{
                                left: `${cursorPosition.x}px`,
                                top: `${cursorPosition.y}px`,
                            }}
                            title={item.user.name}
                        >
                            <div className="flex items-start gap-1.5">
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 18 18"
                                    className="h-5 w-5 shrink-0 drop-shadow-sm"
                                >
                                    <path
                                        d="M3 2L14 10H9.5L11.5 16L9 17L7 11.5L3 14V2Z"
                                        fill="var(--accent)"
                                        stroke="white"
                                        strokeWidth="1.25"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                <div className="max-w-28 rounded-full bg-[var(--accent)] px-2 py-1 text-xs font-medium text-[var(--accent-foreground)] shadow-sm">
                                    <span className="block truncate">
                                        {label}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
