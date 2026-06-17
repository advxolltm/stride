import { useCallback, useEffect, useMemo, useRef } from 'react'
import { isInvisiblySmallElement } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
    sendWhiteboardLiveClear,
    sendWhiteboardLiveUpdate,
    useCreateProjectWhiteboardElementMutation,
    useDeleteProjectWhiteboardElementsBulkMutation,
    useUpdateProjectWhiteboardElementsBulkMutation,
} from '../../../../../store/features/whiteboard/whiteboard.api'
import type { WhiteboardElement } from '../../../../../store/features/whiteboard/whiteboard.api.types'
import type { WhiteboardLiveUpdateEventPayload } from '../../../../../store/features/whiteboard/whiteboard.socket.types'
import { useWhiteboardCursorSync } from './useWhiteboardCursorSync'
import {
    buildExcalidrawElements,
    filterElementIDSet,
    serializeElementSnapshot,
    toWhiteboardElementPayload,
} from './whiteboardSync.utils'

type UseWhiteboardSyncArgs = {
    projectId?: string
    isReadOnly?: boolean
    whiteboardElements: WhiteboardElement[]
    liveElementsById: Record<string, WhiteboardLiveUpdateEventPayload>
}

type PendingBulkUpdateElement = {
    element: ExcalidrawElement
    backendElementId: string
    snapshot: string
}

type WhiteboardSyncState = {
    excalidrawToBackendElementId: Map<string, string>
    pendingCreateElementIds: Set<string>
    pendingDeleteElementIds: Set<string>
    pendingUpdateElementIds: Set<string>
    pendingDeleteBackendElementIds: Map<string, string>
    persistedElementSnapshots: Map<string, string>
    localSceneSnapshots: Map<string, string>
    pendingLiveElements: Map<string, WhiteboardLiveUpdateEventPayload>
    touchedLiveElementIds: Set<string>
    lastSentLiveSnapshots: Map<string, string>
    isElementIdMappingReady: boolean
}

const createWhiteboardSyncState = (): WhiteboardSyncState => ({
    excalidrawToBackendElementId: new Map(),
    pendingCreateElementIds: new Set(),
    pendingDeleteElementIds: new Set(),
    pendingUpdateElementIds: new Set(),
    pendingDeleteBackendElementIds: new Map(),
    persistedElementSnapshots: new Map(),
    localSceneSnapshots: new Map(),
    pendingLiveElements: new Map(),
    touchedLiveElementIds: new Set(),
    lastSentLiveSnapshots: new Map(),
    isElementIdMappingReady: false,
})

export const useWhiteboardSync = ({
    projectId,
    isReadOnly = false,
    whiteboardElements,
    liveElementsById,
}: UseWhiteboardSyncArgs) => {
    const syncStateRef = useRef<WhiteboardSyncState>(createWhiteboardSyncState())
    const liveFrameRef = useRef<number | null>(null)
    const deleteFlushTimeoutRef = useRef<number | null>(null)
    const isDeleteFlushInFlightRef = useRef(false)
    const [createProjectWhiteboardElement] =
        useCreateProjectWhiteboardElementMutation()
    const [deleteProjectWhiteboardElementsBulk] =
        useDeleteProjectWhiteboardElementsBulkMutation()
    const [updateProjectWhiteboardElementsBulk] =
        useUpdateProjectWhiteboardElementsBulkMutation()
    const { clearCursor, queueCursorUpdate } = useWhiteboardCursorSync({
        projectId,
    })

    useEffect(() => {
        syncStateRef.current = createWhiteboardSyncState()
    }, [projectId])

    const flushPendingLiveUpdates = () => {
        const syncState = syncStateRef.current
        liveFrameRef.current = null
        if (!projectId || syncState.pendingLiveElements.size === 0) {
            return
        }

        syncState.pendingLiveElements.forEach((payload, elementId) => {
            if (sendWhiteboardLiveUpdate(projectId, payload)) {
                syncState.lastSentLiveSnapshots.set(
                    elementId,
                    serializeElementSnapshot(payload.props),
                )
            }
        })
        syncState.pendingLiveElements.clear()
    }

    const clearLiveElement = useCallback(
        (elementId: string) => {
            const syncState = syncStateRef.current
            if (!projectId || !syncState.touchedLiveElementIds.has(elementId)) {
                return
            }

            sendWhiteboardLiveClear(projectId, elementId)
            syncState.pendingLiveElements.delete(elementId)
            syncState.lastSentLiveSnapshots.delete(elementId)
            syncState.touchedLiveElementIds.delete(elementId)
        },
        [projectId],
    )

    const queueLiveUpdate = (element: ExcalidrawElement) => {
        const syncState = syncStateRef.current
        const nextSnapshot = serializeElementSnapshot(element)
        const pendingLiveElement = syncState.pendingLiveElements.get(element.id)
        const previousSnapshot = pendingLiveElement
            ? serializeElementSnapshot(pendingLiveElement.props)
            : syncState.lastSentLiveSnapshots.get(element.id) ??
              syncState.persistedElementSnapshots.get(element.id)

        if (previousSnapshot === nextSnapshot) {
            return
        }

        syncState.pendingLiveElements.set(element.id, {
            elementId: element.id,
            elementType: element.type,
            props: element,
            zIndex: 0,
        })
        syncState.touchedLiveElementIds.add(element.id)

        if (liveFrameRef.current !== null) {
            return
        }

        liveFrameRef.current = window.requestAnimationFrame(
            flushPendingLiveUpdates,
        )
    }

    useEffect(() => {
        const syncState = syncStateRef.current
        const persistedElementIDs = new Set(
            whiteboardElements.map((backendElement) => backendElement.props.id),
        )

        syncState.excalidrawToBackendElementId = new Map(
            whiteboardElements.map((backendElement) => [
                backendElement.props.id,
                backendElement.id,
            ]),
        )
        syncState.persistedElementSnapshots = new Map(
            whiteboardElements.map((backendElement) => [
                backendElement.props.id,
                serializeElementSnapshot(backendElement.props),
            ]),
        )
        syncState.localSceneSnapshots = new Map(
            whiteboardElements.map((backendElement) => [
                backendElement.props.id,
                serializeElementSnapshot(backendElement.props),
            ]),
        )
        syncState.pendingCreateElementIds = filterElementIDSet(
            syncState.pendingCreateElementIds,
            (elementID) => !persistedElementIDs.has(elementID),
        )
        syncState.pendingDeleteElementIds = filterElementIDSet(
            syncState.pendingDeleteElementIds,
            (elementID) => persistedElementIDs.has(elementID),
        )
        syncState.pendingUpdateElementIds = filterElementIDSet(
            syncState.pendingUpdateElementIds,
            (elementID) => persistedElementIDs.has(elementID),
        )
        syncState.isElementIdMappingReady = true
    }, [whiteboardElements])

    const flushPendingDeletes = useCallback(() => {
        const syncState = syncStateRef.current
        deleteFlushTimeoutRef.current = null

        if (!projectId || syncState.pendingDeleteBackendElementIds.size === 0) {
            return
        }

        if (isDeleteFlushInFlightRef.current) {
            return
        }

        const deletedElements = Array.from(
            syncState.pendingDeleteBackendElementIds.entries(),
        )
        const backendElementIds = deletedElements.map(([, backendElementId]) => {
            return backendElementId
        })

        isDeleteFlushInFlightRef.current = true

        void deleteProjectWhiteboardElementsBulk({
            projectId,
            elementIds: backendElementIds,
        })
            .unwrap()
            .then(() => {
                deletedElements.forEach(([elementId]) => {
                    syncState.pendingDeleteBackendElementIds.delete(elementId)
                    syncState.excalidrawToBackendElementId.delete(elementId)
                    syncState.persistedElementSnapshots.delete(elementId)
                    syncState.localSceneSnapshots.delete(elementId)
                })
            })
            .finally(() => {
                isDeleteFlushInFlightRef.current = false
                deletedElements.forEach(([elementId]) => {
                    if (!syncState.pendingDeleteBackendElementIds.has(elementId)) {
                        syncState.pendingDeleteElementIds.delete(elementId)
                        clearLiveElement(elementId)
                    }
                })
            })
    }, [clearLiveElement, deleteProjectWhiteboardElementsBulk, projectId])

    useEffect(() => {
        return () => {
            const syncState = syncStateRef.current
            if (liveFrameRef.current !== null) {
                window.cancelAnimationFrame(liveFrameRef.current)
            }
            if (deleteFlushTimeoutRef.current !== null) {
                window.clearTimeout(deleteFlushTimeoutRef.current)
                deleteFlushTimeoutRef.current = null
            }
            flushPendingDeletes()

            if (projectId) {
                Array.from(syncState.touchedLiveElementIds).forEach(
                    (elementId) => {
                        sendWhiteboardLiveClear(projectId, elementId)
                        syncState.pendingLiveElements.delete(elementId)
                        syncState.lastSentLiveSnapshots.delete(elementId)
                        syncState.touchedLiveElementIds.delete(elementId)
                    },
                )
                clearCursor()
            }
        }
    }, [clearCursor, flushPendingDeletes, projectId])

    const schedulePendingDeleteFlush = () => {
        if (deleteFlushTimeoutRef.current !== null) {
            return
        }

        deleteFlushTimeoutRef.current = window.setTimeout(
            flushPendingDeletes,
            0,
        )
    }

    const deletePersistedElement = (elementId: string) => {
        if (!projectId) {
            return
        }

        const syncState = syncStateRef.current
        const backendElementId = syncState.excalidrawToBackendElementId.get(elementId)

        syncState.pendingCreateElementIds.delete(elementId)
        syncState.pendingUpdateElementIds.delete(elementId)

        if (
            !backendElementId ||
            syncState.pendingDeleteElementIds.has(elementId)
        ) {
            syncState.persistedElementSnapshots.delete(elementId)
            return
        }

        syncState.pendingDeleteElementIds.add(elementId)
        syncState.pendingDeleteBackendElementIds.set(elementId, backendElementId)
        schedulePendingDeleteFlush()
    }

    const handleCanvasChange = (elements: readonly ExcalidrawElement[]) => {
        const syncState = syncStateRef.current
        if (!projectId || isReadOnly || !syncState.isElementIdMappingReady) {
            return
        }

        elements.forEach((element) => {
            const nextSnapshot = serializeElementSnapshot(element)
            const previousSnapshot = syncState.localSceneSnapshots.get(element.id)

            if (element.isDeleted) {
                syncState.localSceneSnapshots.delete(element.id)
                deletePersistedElement(element.id)
                return
            }

            if (previousSnapshot === nextSnapshot) {
                return
            }

            syncState.localSceneSnapshots.set(element.id, nextSnapshot)
            queueLiveUpdate(element)
        })
    }

    const handleCanvasPointerUp = (elements: readonly ExcalidrawElement[]) => {
        const syncState = syncStateRef.current
        if (!projectId || isReadOnly || !syncState.isElementIdMappingReady) {
            return
        }

        if (liveFrameRef.current !== null) {
            window.cancelAnimationFrame(liveFrameRef.current)
            flushPendingLiveUpdates()
        }

        const updatedElements: PendingBulkUpdateElement[] = []

        elements.forEach((element) => {
            const nextSnapshot = serializeElementSnapshot(element)
            const backendElementId =
                syncState.excalidrawToBackendElementId.get(element.id)

            if (element.isDeleted) {
                syncState.localSceneSnapshots.delete(element.id)
                deletePersistedElement(element.id)
                return
            }

            syncState.localSceneSnapshots.set(element.id, nextSnapshot)

            if (
                isInvisiblySmallElement(element) ||
                syncState.pendingCreateElementIds.has(element.id)
            ) {
                clearLiveElement(element.id)
                return
            }

            if (!backendElementId) {
                syncState.pendingCreateElementIds.add(element.id)

                void createProjectWhiteboardElement({
                    projectId,
                    body: toWhiteboardElementPayload(element),
                })
                    .unwrap()
                    .then((createdElement) => {
                        syncState.excalidrawToBackendElementId.set(
                            element.id,
                            createdElement.id,
                        )
                        syncState.persistedElementSnapshots.set(
                            element.id,
                            nextSnapshot,
                        )
                    })
                    .finally(() => {
                        syncState.pendingCreateElementIds.delete(element.id)
                        clearLiveElement(element.id)
                    })
                return
            }

            if (
                syncState.pendingUpdateElementIds.has(element.id) ||
                syncState.persistedElementSnapshots.get(element.id) ===
                    nextSnapshot
            ) {
                clearLiveElement(element.id)
                return
            }

            syncState.pendingUpdateElementIds.add(element.id)
            updatedElements.push({
                element,
                backendElementId,
                snapshot: nextSnapshot,
            })
        })

        if (updatedElements.length === 0) {
            return
        }

        void updateProjectWhiteboardElementsBulk({
            projectId,
            body: updatedElements.map(({ element, backendElementId }) => ({
                elementId: backendElementId,
                ...toWhiteboardElementPayload(element),
            })),
        })
            .unwrap()
            .then(() => {
                updatedElements.forEach(({ element, snapshot }) => {
                    syncState.persistedElementSnapshots.set(
                        element.id,
                        snapshot,
                    )
                })
            })
            .finally(() => {
                updatedElements.forEach(({ element }) => {
                    syncState.pendingUpdateElementIds.delete(element.id)
                    clearLiveElement(element.id)
                })
            })
    }

    const excalidrawElements = useMemo(
        () => buildExcalidrawElements(whiteboardElements, liveElementsById),
        [whiteboardElements, liveElementsById],
    )

    return {
        excalidrawElements,
        handleCanvasChange,
        handleCanvasPointerUp,
        queueCursorUpdate,
    }
}
