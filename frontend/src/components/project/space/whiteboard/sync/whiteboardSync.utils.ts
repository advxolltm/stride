import { restoreElements } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { WhiteboardElement } from '../../../../../store/features/whiteboard/whiteboard.api.types'
import type { WhiteboardLiveUpdateEventPayload } from '../../../../../store/features/whiteboard/whiteboard.socket.types'

export const serializeElementSnapshot = (
    element: ExcalidrawElement,
    zIndex: number,
) =>
    JSON.stringify({
        elementType: element.type,
        props: element,
        zIndex,
    })

export const filterElementIDSet = (
    elementIDs: Set<string>,
    predicate: (elementID: string) => boolean,
) => new Set([...elementIDs].filter(predicate))

export const toWhiteboardElementPayload = (
    element: ExcalidrawElement,
    zIndex: number,
) => ({
    elementType: element.type,
    props: element,
    zIndex,
})

export const mergeRenderedWhiteboardElements = (
    persistedElements: WhiteboardElement[],
    liveElementsById: Record<string, WhiteboardLiveUpdateEventPayload>,
) => {
    const mergedElements = persistedElements.map((element) => {
        const liveOverlay = liveElementsById[element.props.id]
        if (!liveOverlay) {
            return {
                props: element.props,
                zIndex: element.zIndex,
            }
        }

        return {
            props: liveOverlay.props,
            zIndex: liveOverlay.zIndex,
        }
    })

    const persistedElementIDs = new Set(
        persistedElements.map((element) => element.props.id),
    )

    Object.values(liveElementsById).forEach((liveOverlay) => {
        if (persistedElementIDs.has(liveOverlay.elementId)) {
            return
        }

        mergedElements.push({
            props: liveOverlay.props,
            zIndex: liveOverlay.zIndex,
        })
    })

    return mergedElements
}

export const buildExcalidrawElements = (
    whiteboardElements: WhiteboardElement[],
    liveElementsById: Record<string, WhiteboardLiveUpdateEventPayload>,
) =>
    restoreElements(
        mergeRenderedWhiteboardElements(whiteboardElements, liveElementsById)
            .sort((left, right) => left.zIndex - right.zIndex)
            .map((element) => element.props),
        null,
    )
