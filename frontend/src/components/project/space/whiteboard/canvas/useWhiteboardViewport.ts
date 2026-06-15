import { useCallback, useMemo, useState } from 'react'
import type { AppState } from '@excalidraw/excalidraw/types'

type PersistedViewport = {
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

export const toViewportCoordinates = (
    sceneX: number,
    sceneY: number,
    viewport: PersistedViewport,
) => ({
    x: (sceneX + viewport.scrollX) * viewport.zoom,
    y: (sceneY + viewport.scrollY) * viewport.zoom,
})

export const useWhiteboardViewport = (viewportStorageKey?: string) => {
    const initialViewport = useMemo(
        () => readPersistedViewport(viewportStorageKey),
        [viewportStorageKey],
    )

    const [viewport, setViewport] = useState<PersistedViewport>(
        initialViewport ?? defaultViewport,
    )

    const initialAppState = initialViewport
        ? {
              scrollX: initialViewport.scrollX,
              scrollY: initialViewport.scrollY,
              zoom: { value: toZoomValue(initialViewport.zoom) },
          }
        : undefined

    const updateViewport = useCallback(
        (scrollX: number, scrollY: number, zoom: AppState['zoom']) => {
            const nextViewport = {
                scrollX,
                scrollY,
                zoom: zoom.value,
            }

            setViewport(nextViewport)
            persistViewport(viewportStorageKey, nextViewport)
        },
        [viewportStorageKey],
    )

    return {
        initialAppState,
        updateViewport,
        viewport,
    }
}
