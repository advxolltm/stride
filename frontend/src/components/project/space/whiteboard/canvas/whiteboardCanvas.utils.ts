import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'

const toDeletedExternalElement = (
    element: OrderedExcalidrawElement,
): OrderedExcalidrawElement => ({
    ...element,
    isDeleted: true,
    version: element.version + 1,
    versionNonce: element.versionNonce + 1,
})

export const mergeExternalSceneDeletes = (
    previousExternalScene: readonly OrderedExcalidrawElement[],
    nextExternalScene: readonly OrderedExcalidrawElement[],
    currentCanvasScene: readonly OrderedExcalidrawElement[] = previousExternalScene,
) => {
    if (previousExternalScene.length === 0) {
        return nextExternalScene
    }

    const nextElementIDs = new Set(
        nextExternalScene.map((element) => element.id),
    )
    const currentCanvasElementsByID = new Map(
        currentCanvasScene.map((element) => [element.id, element]),
    )

    const deletedExternalElements = previousExternalScene
        .filter(
            (element) => !element.isDeleted && !nextElementIDs.has(element.id),
        )
        .map((element) =>
            toDeletedExternalElement(
                currentCanvasElementsByID.get(element.id) ?? element,
            ),
        )

    if (deletedExternalElements.length === 0) {
        return nextExternalScene
    }

    return [...nextExternalScene, ...deletedExternalElements]
}
