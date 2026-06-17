import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import {
    CaptureUpdateAction,
    Excalidraw,
    MainMenu,
    THEME,
    reconcileElements,
} from '@excalidraw/excalidraw'
import type {
    ExcalidrawElement,
    OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import './WhiteboardCanvas.css'

import type { WhiteboardCanvasProps } from './whiteboardCanvas.types'
import {
    toViewportCoordinates,
    useWhiteboardViewport,
} from './useWhiteboardViewport'
import { useAppSelector } from '../../../../../shared/hooks/redux'
import getInitials from '../../../../../shared/utils/getInitials'
import { mergeExternalSceneDeletes } from './whiteboardCanvas.utils'

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

const getSceneSignature = (elements: readonly ExcalidrawElement[]) =>
    elements
        .map((element) =>
            [
                element.id,
                element.version,
                element.versionNonce,
                element.isDeleted ? 1 : 0,
            ].join(':'),
        )
        .join('|')

export const WhiteboardCanvas = forwardRef<
    ExcalidrawImperativeAPI | null,
    WhiteboardCanvasProps
>(function WhiteboardCanvas({
    elements,
    focusTarget,
    presence = [],
    remoteSelectionClientIdsByElementId = {},
    viewportStorageKey,
    taskPreviewModeEnabled = false,
    viewModeEnabled = false,
    onChange,
    onPointerUp,
    onCursorChange,
    onSelectionChange,
    onElementsSelectedChanged,
}, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null)

    const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
    useImperativeHandle(ref, () => excalidrawApiRef.current!);

    const isDarkMode = useAppSelector((state) => state.theme.isDark)
    const latestExternalSceneRef =
        useRef<readonly OrderedExcalidrawElement[]>(elements)
    const lastAppliedExternalSceneRef =
        useRef<readonly OrderedExcalidrawElement[]>(elements)
    const isLocallyInteractingRef = useRef(false)
    const externalSceneSignatureRef = useRef<string | null>(null)
    const lastSelectionSignatureRef = useRef('')

    const sceneElements = useMemo(
        () => elements.map((element) => ({ ...element })),
        [elements],
    )
    const { initialAppState, updateViewport, viewport } =
        useWhiteboardViewport(viewportStorageKey)

    const remoteSelectionHighlights = useMemo(
        () =>
            elements.flatMap((element) => {
                if (
                    element.isDeleted ||
                    !remoteSelectionClientIdsByElementId[element.id]?.length
                ) {
                    return []
                }

                const topLeft = toViewportCoordinates(
                    element.x,
                    element.y,
                    viewport,
                )
                return [
                    {
                        element,
                        left: topLeft.x,
                        top: topLeft.y,
                        width: element.width * viewport.zoom,
                        height: element.height * viewport.zoom,
                    },
                ]
            }),
        [elements, remoteSelectionClientIdsByElementId, viewport],
    )

    const applyExternalScene = (
        nextSceneElements: readonly OrderedExcalidrawElement[],
    ) => {
        const excalidrawApi = excalidrawApiRef.current
        if (!excalidrawApi) {
            return
        }

        const currentCanvasScene =
            excalidrawApi.getSceneElementsIncludingDeleted()
        const reconciledExternalScene = mergeExternalSceneDeletes(
            lastAppliedExternalSceneRef.current,
            nextSceneElements,
            currentCanvasScene,
        )
        const reconciledElements = reconcileElements(
            currentCanvasScene,
            reconciledExternalScene as Parameters<typeof reconcileElements>[1],
            excalidrawApi.getAppState(),
        )

        lastAppliedExternalSceneRef.current = nextSceneElements
        externalSceneSignatureRef.current =
            getSceneSignature(reconciledElements)
        excalidrawApi.updateScene({
            elements: reconciledElements,
            captureUpdate: CaptureUpdateAction.NEVER,
        })
    }

    useEffect(() => {
        latestExternalSceneRef.current = sceneElements
        if (isLocallyInteractingRef.current) {
            return
        }

        applyExternalScene(sceneElements)
    }, [sceneElements])

    useEffect(() => {
        if (!focusTarget) {
            return
        }

        const excalidrawApi = excalidrawApiRef.current
        const container = containerRef.current

        if (!excalidrawApi || !container) {
            return
        }

        const appState = excalidrawApi.getAppState()
        const zoom = appState.zoom
        const nextScrollX =
            container.clientWidth / (2 * zoom.value) - focusTarget.x
        const nextScrollY =
            container.clientHeight / (2 * zoom.value) - focusTarget.y

        excalidrawApi.updateScene({
            appState: {
                scrollX: nextScrollX,
                scrollY: nextScrollY,
            },
            captureUpdate: CaptureUpdateAction.NEVER,
        })
        updateViewport(nextScrollX, nextScrollY, zoom)
    }, [focusTarget?.nonce, focusTarget, updateViewport])

    const handleElementsChange = (nextElements: readonly OrderedExcalidrawElement[]) => {
        const nextSceneSignature = getSceneSignature(nextElements);
        if (externalSceneSignatureRef.current !== null && nextSceneSignature === externalSceneSignatureRef.current) { 
			externalSceneSignatureRef.current = null;
			return;
		}

        onChange?.(nextElements)
    }

    const handleSelectionChange = (nextElements: readonly OrderedExcalidrawElement[], appState: AppState) => {
        const selectedElements = nextElements.filter(el => appState.selectedElementIds[el.id]);
        const selectedGroupedElements = nextElements.filter(el => el.groupIds.some(groupId => appState.selectedGroupIds[groupId]));
        const editingTextElementIds = appState.editingTextElement
            ? [
                  appState.editingTextElement.id,
                  ...(appState.editingTextElement.type === 'text' &&
                  appState.editingTextElement.containerId
                      ? [appState.editingTextElement.containerId]
                      : []),
              ]
            : []
        const selectedElementIds = Array.from(
            new Set(
                [
                    ...selectedElements.map((element) => element.id),
                    ...selectedGroupedElements.map((element) => element.id),
                    ...editingTextElementIds,
                ],
            ),
        ).sort()
        const nextSelectionSignature = selectedElementIds.join('|')
        if (lastSelectionSignatureRef.current !== nextSelectionSignature) {
            lastSelectionSignatureRef.current = nextSelectionSignature
            onSelectionChange?.(selectedElementIds)
        }
        onElementsSelectedChanged?.(selectedElements, selectedGroupedElements, Object.keys(appState.selectedGroupIds));
    }

    return (
        <div
            ref={containerRef}
            className="whiteboard-excalidraw relative h-full w-full overflow-hidden"
        >
            <Excalidraw
                initialData={{
                    elements: sceneElements,
                    appState: initialAppState,
                }}
                excalidrawAPI={(api) => {
                    excalidrawApiRef.current = api
                }}
                viewModeEnabled={viewModeEnabled}
                theme={isDarkMode ? THEME.DARK : THEME.LIGHT}
                UIOptions={{
                    tools: {
                        image: false,
                    },
                }}
                onChange={(nextElements, appState) => {
					handleElementsChange(nextElements);
					handleSelectionChange(nextElements, appState);
                }}
                onPointerDown={() => {
                    isLocallyInteractingRef.current = true
                }}
                onPointerUpdate={(payload) => {
                    onCursorChange?.({
                        cursor: {
                            x: payload.pointer.x,
                            y: payload.pointer.y,
                        },
                    })
                }}
                onScrollChange={updateViewport}
                onPointerUp={() => {
                    isLocallyInteractingRef.current = false
                    applyExternalScene(latestExternalSceneRef.current)
                    onPointerUp?.(
                        excalidrawApiRef.current?.getSceneElementsIncludingDeleted() ??
                        [],
                    )
                }}
            >
                {!taskPreviewModeEnabled &&
                    <MainMenu>
                        <MainMenu.DefaultItems.LoadScene />
                        <MainMenu.DefaultItems.Export />
                        <MainMenu.DefaultItems.SaveAsImage />
                        <MainMenu.DefaultItems.SearchMenu />
                        <MainMenu.DefaultItems.Help />
                        <MainMenu.DefaultItems.ClearCanvas />
                        <MainMenu.Separator />
                        <MainMenu.DefaultItems.ChangeCanvasBackground />
                    </MainMenu>
                }
            </Excalidraw>
            <div className="pointer-events-none absolute inset-0 z-10">
                {remoteSelectionHighlights.map((highlight) => (
                    <div
                        key={highlight.element.id}
                        className="absolute rounded-[3px] border-2 border-dashed border-[#f59e0b] shadow-[0_0_0_2px_rgba(245,158,11,0.18)]"
                        style={{
                            left: `${highlight.left - 4}px`,
                            top: `${highlight.top - 4}px`,
                            width: `${highlight.width + 8}px`,
                            height: `${highlight.height + 8}px`,
                            transform: `rotate(${highlight.element.angle}rad)`,
                            transformOrigin: 'center',
                        }}
                    />
                ))}
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
})
