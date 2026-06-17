import { restoreElements } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { WhiteboardElement } from '../../../../../store/features/whiteboard/whiteboard.api.types'
import type { WhiteboardLiveUpdateEventPayload } from '../../../../../store/features/whiteboard/whiteboard.socket.types'

type RenderedWhiteboardElement = {
    props: ExcalidrawElement
    zIndex: number
    fallbackOrder: number
}

export const serializeElementSnapshot = (element: ExcalidrawElement) =>
    JSON.stringify((() => {
        const {
            version: _version,
            versionNonce: _versionNonce,
            seed: _seed,
            updated: _updated,
            ...props
        } = element

        return {
            elementType: element.type,
            props,
        }
    })())

export const filterElementIDSet = (
    elementIDs: Set<string>,
    predicate: (elementID: string) => boolean,
) => new Set([...elementIDs].filter(predicate))

export const toWhiteboardElementPayload = (
    element: ExcalidrawElement,
    zIndex = 0,
) => ({
    elementType: element.type,
    props: element,
    zIndex,
})

const compareRenderedElementOrder = (
    left: RenderedWhiteboardElement,
    right: RenderedWhiteboardElement,
) => {
    const leftIndex = left.props.index
    const rightIndex = right.props.index
    const leftHasIndex = leftIndex !== null
    const rightHasIndex = rightIndex !== null

    if (leftHasIndex && rightHasIndex) {
        if (leftIndex < rightIndex) {
            return -1
        }

        if (leftIndex > rightIndex) {
            return 1
        }

        return left.props.id.localeCompare(right.props.id)
    }

    if (leftHasIndex) {
        return -1
    }

    if (rightHasIndex) {
        return 1
    }

    return left.zIndex - right.zIndex || left.fallbackOrder - right.fallbackOrder
}

export const mergeRenderedWhiteboardElements = (
    persistedElements: WhiteboardElement[],
    liveElementsById: Record<string, WhiteboardLiveUpdateEventPayload>,
) => {
    const mergedElements = persistedElements.map((element, fallbackOrder) => {
        const liveOverlay = liveElementsById[element.props.id]
        if (!liveOverlay) {
            return {
                props: element.props,
                zIndex: element.zIndex,
                fallbackOrder,
            }
        }

        return {
            props: liveOverlay.props,
            zIndex: liveOverlay.zIndex,
            fallbackOrder,
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
            fallbackOrder: mergedElements.length,
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
            .sort(compareRenderedElementOrder)
            .map((element) => element.props),
        null,
        { repairBindings: true },
    )
