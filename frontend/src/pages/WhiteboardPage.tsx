import { useEffect, useMemo, useRef } from 'react'
import { Button, toast } from '@heroui/react'
import { isInvisiblySmallElement, restoreElements } from '@excalidraw/excalidraw'
import { skipToken } from '@reduxjs/toolkit/query'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Home, Share2, Zap } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { WhiteboardCanvas } from '../components/project/space/whiteboard/WhiteboardCanvas'
import { getApiErrorMessage } from '../shared/utils/api/errors'
import { useAppSelector } from '../shared/hooks/redux'
import { useGetProjectByIdQuery } from '../store/features/project/project.api'
import {
    sendWhiteboardCursor,
    useCreateProjectWhiteboardElementMutation,
    useDeleteProjectWhiteboardElementMutation,
    useGetProjectWhiteboardElementsQuery,
    useGetProjectWhiteboardQuery,
    useUpdateProjectWhiteboardElementMutation,
    useWatchWhiteboardCursorQuery,
    useWatchWhiteboardEventsQuery,
} from '../store/features/whiteboard/whiteboard.api'
import type { WhiteboardCursorClientMessage } from '../store/features/whiteboard/whiteboard.types'
import { selectUserId } from '../store/userSlice'
import getInitials from '../shared/utils/getInitials'

const emptyCursorMessage: WhiteboardCursorClientMessage = {
    cursor: { x: null, y: null },
}

const serializeElementSnapshot = (
    element: ExcalidrawElement,
    zIndex: number,
) =>
    JSON.stringify({
        elementType: element.type,
        props: element,
        zIndex,
    })

const filterElementIDSet = (
    elementIDs: Set<string>,
    predicate: (elementID: string) => boolean,
) => new Set([...elementIDs].filter(predicate))

const toWhiteboardElementPayload = (
    element: ExcalidrawElement,
    zIndex: number,
) => ({
    elementType: element.type,
    props: element,
    zIndex,
})

export function WhiteboardPage() {
    const { projectId } = useParams()
    const { t } = useTranslation('project')
    const currentUserId = useAppSelector(selectUserId)
    const excalidrawToBackendElementIdRef = useRef(new Map<string, string>())
    const pendingCreateElementIdsRef = useRef(new Set<string>())
    const pendingDeleteElementIdsRef = useRef(new Set<string>())
    const pendingUpdateElementIdsRef = useRef(new Set<string>())
    const persistedElementSnapshotsRef = useRef(new Map<string, string>())
    const isElementIdMappingReadyRef = useRef(false)
    const cursorFrameRef = useRef<number | null>(null)
    const pendingCursorMessageRef =
        useRef<WhiteboardCursorClientMessage | null>(null)
    const [createProjectWhiteboardElement] =
        useCreateProjectWhiteboardElementMutation()
    const [deleteProjectWhiteboardElement] =
        useDeleteProjectWhiteboardElementMutation()
    const [updateProjectWhiteboardElement] =
        useUpdateProjectWhiteboardElementMutation()
    const whiteboardCursorWS = useWatchWhiteboardCursorQuery(
        projectId ?? skipToken,
    )
    useWatchWhiteboardEventsQuery(projectId ?? skipToken)
    const {
        data: project,
        isLoading: isProjectLoading,
        error: projectError,
    } = useGetProjectByIdQuery(projectId ?? '', {
        skip: !projectId,
    })
    const {
        isSuccess: isWhiteboardReady,
        isLoading: isWhiteboardLoading,
        error: whiteboardError,
    } = useGetProjectWhiteboardQuery(projectId ?? '', {
        skip: !projectId,
    })
    const {
        data: whiteboardElements = [],
        isLoading: isElementsLoading,
        isSuccess: isElementsReady,
        error: elementsError,
    } = useGetProjectWhiteboardElementsQuery(projectId ?? '', {
        skip: !projectId || !isWhiteboardReady,
    })

    useEffect(() => {
        excalidrawToBackendElementIdRef.current = new Map()
        pendingCreateElementIdsRef.current = new Set()
        pendingDeleteElementIdsRef.current = new Set()
        pendingUpdateElementIdsRef.current = new Set()
        persistedElementSnapshotsRef.current = new Map()
        isElementIdMappingReadyRef.current = false
    }, [projectId])

    const flushPendingCursor = () => {
        cursorFrameRef.current = null
        if (!projectId || !pendingCursorMessageRef.current) {
            return
        }

        sendWhiteboardCursor(projectId, pendingCursorMessageRef.current)
        pendingCursorMessageRef.current = null
    }

    const queueCursorUpdate = (message: WhiteboardCursorClientMessage) => {
        pendingCursorMessageRef.current = message

        if (cursorFrameRef.current !== null) {
            return
        }

        cursorFrameRef.current = window.requestAnimationFrame(
            flushPendingCursor,
        )
    }

    useEffect(() => {
        const persistedElementIDs = new Set(
            whiteboardElements.map((backendElement) => backendElement.props.id),
        )

        excalidrawToBackendElementIdRef.current = new Map(
            whiteboardElements.map((backendElement) => [
                backendElement.props.id,
                backendElement.id,
            ]),
        )
        persistedElementSnapshotsRef.current = new Map(
            whiteboardElements.map((backendElement) => [
                backendElement.props.id,
                serializeElementSnapshot(
                    backendElement.props,
                    backendElement.zIndex,
                ),
            ]),
        )
        pendingCreateElementIdsRef.current = filterElementIDSet(
            pendingCreateElementIdsRef.current,
            (elementID) => !persistedElementIDs.has(elementID),
        )
        pendingDeleteElementIdsRef.current = filterElementIDSet(
            pendingDeleteElementIdsRef.current,
            (elementID) => persistedElementIDs.has(elementID),
        )
        pendingUpdateElementIdsRef.current = filterElementIDSet(
            pendingUpdateElementIdsRef.current,
            (elementID) => persistedElementIDs.has(elementID),
        )
        isElementIdMappingReadyRef.current = true
    }, [whiteboardElements])

    useEffect(() => {
        return () => {
            if (cursorFrameRef.current !== null) {
                window.cancelAnimationFrame(cursorFrameRef.current)
            }

            if (projectId) {
                sendWhiteboardCursor(projectId, emptyCursorMessage)
            }
        }
    }, [projectId])

    const deletePersistedElement = (projectId: string, elementId: string) => {
        const backendElementId =
            excalidrawToBackendElementIdRef.current.get(elementId)

        pendingCreateElementIdsRef.current.delete(elementId)
        pendingUpdateElementIdsRef.current.delete(elementId)

        if (
            !backendElementId ||
            pendingDeleteElementIdsRef.current.has(elementId)
        ) {
            persistedElementSnapshotsRef.current.delete(elementId)
            return
        }

        pendingDeleteElementIdsRef.current.add(elementId)

        void deleteProjectWhiteboardElement({
            projectId,
            elementId: backendElementId,
        })
            .unwrap()
            .then(() => {
                excalidrawToBackendElementIdRef.current.delete(elementId)
                persistedElementSnapshotsRef.current.delete(elementId)
            })
            .finally(() => {
                pendingDeleteElementIdsRef.current.delete(elementId)
            })
    }

    const handleShare = async () => {
        const shareUrl = project?.joinLink ?? window.location.href

        try {
            await navigator.clipboard.writeText(shareUrl)
            toast.success(t('whiteboardPage.shareSuccess'))
        } catch {
            toast.danger(t('whiteboardPage.shareError'))
        }
    }

    const handleCanvasChange = (elements: readonly ExcalidrawElement[]) => {
        if (!projectId || !isElementIdMappingReadyRef.current) {
            return
        }

        elements.forEach((element) => {
            if (!element.isDeleted) {
                return
            }

            deletePersistedElement(projectId, element.id)
        })
    }

    const handleCanvasPointerUp = (elements: readonly ExcalidrawElement[]) => {
        if (!projectId || !isElementIdMappingReadyRef.current) {
            return
        }

        elements.forEach((element, index) => {
            const nextSnapshot = serializeElementSnapshot(element, index)
            const backendElementId =
                excalidrawToBackendElementIdRef.current.get(element.id)

            if (element.isDeleted) {
                deletePersistedElement(projectId, element.id)
                return
            }

            if (
                isInvisiblySmallElement(element) ||
                pendingCreateElementIdsRef.current.has(element.id)
            ) {
                return
            }

            if (!backendElementId) {
                pendingCreateElementIdsRef.current.add(element.id)

                void createProjectWhiteboardElement({
                    projectId,
                    body: toWhiteboardElementPayload(element, index),
                })
                    .unwrap()
                    .then((createdElement) => {
                        excalidrawToBackendElementIdRef.current.set(
                            element.id,
                            createdElement.id,
                        )
                        persistedElementSnapshotsRef.current.set(
                            element.id,
                            nextSnapshot,
                        )
                    })
                    .finally(() => {
                        pendingCreateElementIdsRef.current.delete(element.id)
                    })
                return
            }

            if (
                pendingUpdateElementIdsRef.current.has(element.id) ||
                persistedElementSnapshotsRef.current.get(element.id) ===
                    nextSnapshot
            ) {
                return
            }

            pendingUpdateElementIdsRef.current.add(element.id)

            void updateProjectWhiteboardElement({
                projectId,
                elementId: backendElementId,
                body: toWhiteboardElementPayload(element, index),
            })
                .unwrap()
                .then(() => {
                    persistedElementSnapshotsRef.current.set(
                        element.id,
                        nextSnapshot,
                    )
                })
                .finally(() => {
                    pendingUpdateElementIdsRef.current.delete(element.id)
                })
        })
    }

    const handleCanvasPointerLeave = () => {
        queueCursorUpdate(emptyCursorMessage)
    }

    const excalidrawElements = useMemo(
        () =>
            restoreElements(
                [...whiteboardElements]
                    .sort((left, right) => left.zIndex - right.zIndex)
                    .map((element) => element.props),
                null,
            ),
        [whiteboardElements],
    )

    if (!projectId) {
        return null
    }

    const isLoading =
        isProjectLoading ||
        isWhiteboardLoading ||
        !isWhiteboardReady ||
        !isElementsReady ||
        isElementsLoading
    const loadingMessage = isWhiteboardReady
        ? t('whiteboardPage.loadingElements')
        : t('whiteboardPage.loading')
    const pageError = projectError ?? whiteboardError ?? elementsError

    if (pageError) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--background)] p-6 text-center">
                <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                    <h1 className="text-lg font-semibold text-[var(--foreground)]">
                        {t('whiteboardPage.errorTitle')}
                    </h1>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                        {getApiErrorMessage(
                            pageError,
                            t('whiteboardPage.errorFallback'),
                        )}
                    </p>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--background)] p-6 text-center">
                <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-5 shadow-sm">
                    <h1 className="text-lg font-semibold text-[var(--foreground)]">
                        {loadingMessage}
                    </h1>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                        {t('whiteboardPage.loadingDescription')}
                    </p>
                </div>
            </div>
        )
    }

    const projectName = project?.name ?? projectId
    const collaborators = project?.members ?? []
    const presence = whiteboardCursorWS.data?.presence ?? []
    const remotePresence = currentUserId
        ? presence.filter((item) => item.user.id !== currentUserId)
        : presence
    const visibleCollaborators = collaborators.slice(0, 3)
    const hiddenCollaborators = Math.max(collaborators.length - 3, 0)

    return (
        <div className="relative h-screen w-full overflow-hidden bg-[var(--background)]">
            <nav className="fixed top-3 left-1/2 z-40 flex h-10 -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-2 text-sm shadow-lg backdrop-blur-xl">
                <Link
                    to="/"
                    className="flex h-8 shrink-0 items-center gap-2 rounded-full pr-2 font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)]"
                    aria-label="Stride overview"
                >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                        <Zap size={18} strokeWidth={2.3} />
                    </span>
                    <span>Stride</span>
                </Link>
                <ChevronRight
                    size={14}
                    className="shrink-0 text-[var(--muted)]"
                />
                <Link
                    to="/"
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                    aria-label={t('whiteboardPage.overviewAriaLabel')}
                >
                    <Home size={15} />
                    <span>{t('common:navigation.overview')}</span>
                </Link>
                <ChevronRight
                    size={14}
                    className="shrink-0 text-[var(--muted)]"
                />
                <Link
                    to={`/project/${projectId}`}
                    className="max-w-[160px] truncate rounded-full px-2 py-1 font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                >
                    {projectName}
                </Link>
                <ChevronRight
                    size={14}
                    className="shrink-0 text-[var(--muted)]"
                />
                <span className="rounded-full px-2 py-1 font-semibold text-[var(--foreground)]">
                    {t('spaces.whiteboard')}
                </span>
            </nav>

            <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-10 min-w-10 gap-0 -space-x-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-2 text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
                    aria-label={`${collaborators.length} collaborators, ${presence.length} whiteboard users connected`}
                >
                    {visibleCollaborators.map((member) => {
                        const displayName =
                            member.user.fullName ?? member.user.username

                        return (
                            <span
                                key={member.id}
                                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--accent)] text-[10px] font-semibold text-[var(--accent-foreground)]"
                                title={displayName}
                            >
                                {getInitials(displayName)}
                            </span>
                        )
                    })}
                    {hiddenCollaborators > 0 && (
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface)] px-1 text-[10px] font-semibold text-[var(--muted)]">
                            +{hiddenCollaborators}
                        </span>
                    )}
                    {collaborators.length === 0 && (
                        <span className="px-1.5 text-sm font-medium text-[var(--muted)]">
                            0
                        </span>
                    )}
                </Button>
                <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className="h-10 w-10 min-w-10 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
                    onPress={handleShare}
                    aria-label={t('whiteboardPage.shareAriaLabel')}
                >
                    <Share2 size={16} />
                </Button>
            </div>

            <WhiteboardCanvas
                key={projectId}
                elements={excalidrawElements}
                presence={remotePresence}
                viewportStorageKey={
                    projectId ? `whiteboard:${projectId}:viewport` : undefined
                }
                onChange={handleCanvasChange}
                onPointerUp={handleCanvasPointerUp}
                onCursorChange={queueCursorUpdate}
                onCursorLeave={handleCanvasPointerLeave}
            />
        </div>
    )
}
