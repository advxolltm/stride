import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Tooltip, toast } from '@heroui/react'
import {
    convertToExcalidrawElements,
    isInvisiblySmallElement,
    restoreElements,
} from '@excalidraw/excalidraw'
import { skipToken } from '@reduxjs/toolkit/query'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import { useTranslation } from 'react-i18next'
import {
    ChevronRight,
    Home,
    PanelRightOpen,
    Share2,
    Zap,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { WhiteboardCanvas } from '../components/project/space/whiteboard/WhiteboardCanvas'
import {
    WhiteboardWorkspacePanel,
    type WhiteboardPanelTab,
} from '../components/project/space/whiteboard/WhiteboardWorkspacePanel'
import {
    whiteboardTemplates,
    type WhiteboardTemplateDefinition,
} from '../components/project/space/whiteboard/whiteboardTemplates'
import { getApiErrorMessage } from '../shared/utils/api/errors'
import { useGetProjectByIdQuery } from '../store/features/project/project.api'
import {
    useCreateProjectWhiteboardElementMutation,
    useDeleteProjectWhiteboardElementMutation,
    useGetProjectWhiteboardElementsQuery,
    useGetProjectWhiteboardQuery,
    useUpdateProjectWhiteboardElementMutation,
    useWatchWhiteboardEventsQuery,
} from '../store/features/whiteboard/whiteboard.api'
import { UserAvatar } from '../shared/components'

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

const DOCK_MEDIA_QUERY = '(min-width: 1280px)'

export function WhiteboardPage() {
    const { projectId } = useParams()
    const { t } = useTranslation('project')
    const excalidrawToBackendElementIdRef = useRef(new Map<string, string>())
    const pendingCreateElementIdsRef = useRef(new Set<string>())
    const pendingDeleteElementIdsRef = useRef(new Set<string>())
    const pendingUpdateElementIdsRef = useRef(new Set<string>())
    const persistedElementSnapshotsRef = useRef(new Map<string, string>())
    const isElementIdMappingReadyRef = useRef(false)
    const [isPanelOpen, setIsPanelOpen] = useState(false)
    const [isPanelPinned, setIsPanelPinned] = useState(false)
    const [selectedPanelTab, setSelectedPanelTab] =
        useState<WhiteboardPanelTab>('chat')
    const [canDockPanel, setCanDockPanel] = useState(() =>
        typeof window !== 'undefined'
            ? window.matchMedia(DOCK_MEDIA_QUERY).matches
            : false,
    )
    const [createProjectWhiteboardElement] =
        useCreateProjectWhiteboardElementMutation()
    const [deleteProjectWhiteboardElement] =
        useDeleteProjectWhiteboardElementMutation()
    const [updateProjectWhiteboardElement] =
        useUpdateProjectWhiteboardElementMutation()
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
        refetch: refetchWhiteboardElements,
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

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const mediaQuery = window.matchMedia(DOCK_MEDIA_QUERY)
        const syncDockAvailability = (event?: MediaQueryListEvent) => {
            const matches = event?.matches ?? mediaQuery.matches
            setCanDockPanel(matches)

            if (!matches) {
                setIsPanelPinned(false)
            }
        }

        syncDockAvailability()
        mediaQuery.addEventListener('change', syncDockAvailability)

        return () => {
            mediaQuery.removeEventListener('change', syncDockAvailability)
        }
    }, [])

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

    function handleOpenPanel() {
        setIsPanelOpen(true)
        setSelectedPanelTab('chat')
    }

    function handleClosePanel() {
        setIsPanelOpen(false)
        setIsPanelPinned(false)
    }

    function handleTogglePanelPin() {
        if (!canDockPanel) {
            return
        }

        setIsPanelOpen(true)
        setIsPanelPinned((current) => !current)
    }

    const getTemplateInsertOrigin = () => {
        if (whiteboardElements.length === 0) {
            return { x: 80, y: 80 }
        }

        const maxRight = whiteboardElements.reduce((currentMax, element) => {
            const width =
                typeof element.props.width === 'number'
                    ? element.props.width
                    : 0

            return Math.max(currentMax, element.props.x + width)
        }, 80)

        const minTop = whiteboardElements.reduce((currentMin, element) => {
            return Math.min(currentMin, element.props.y)
        }, 80)

        return {
            x: maxRight + 120,
            y: Math.max(minTop, 80),
        }
    }

    async function handleInsertTemplate(
        template: WhiteboardTemplateDefinition,
    ) {
        if (!projectId) {
            return
        }

        const { x, y } = getTemplateInsertOrigin()
        const nextZIndex = whiteboardElements.reduce(
            (currentMax, element) => Math.max(currentMax, element.zIndex),
            -1,
        )

        try {
            const mermaidResult = await parseMermaidToExcalidraw(
                template.mermaidDefinition,
                {
                    flowchart: { curve: 'linear' },
                    themeVariables: { fontSize: '18px' },
                },
            )
            const templateElements = convertToExcalidrawElements(
                mermaidResult.elements,
                {
                    regenerateIds: true,
                },
            ).map((element) => ({
                ...element,
                x: element.x + x,
                y: element.y + y,
            }))

            await Promise.all(
                templateElements.map((element, index) =>
                    createProjectWhiteboardElement({
                        projectId,
                        body: toWhiteboardElementPayload(
                            element,
                            nextZIndex + index + 1,
                        ),
                    }).unwrap(),
                ),
            )

            await refetchWhiteboardElements()
            toast.success(t('whiteboardPage.templateImportSuccess'))
            if (!isPanelPinned) {
                setIsPanelOpen(false)
            }
        } catch (error) {
            toast.danger(
                getApiErrorMessage(
                    error,
                    t('whiteboardPage.templateImportError'),
                ),
            )
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
    const visibleCollaborators = collaborators.slice(0, 3)
    const hiddenCollaborators = Math.max(collaborators.length - 3, 0)
    const showDockedPanel = isPanelOpen && isPanelPinned && canDockPanel
    const showDrawerPanel = isPanelOpen && !showDockedPanel
    const controlsRightClass = showDockedPanel
        ? 'right-[calc(26rem+1.25rem)]'
        : 'right-3'
    const navPositionClass = showDockedPanel
        ? 'left-[calc(50%-13rem)] max-w-[calc(100vw-32rem)]'
        : 'left-1/2 max-w-[calc(100vw-16rem)]'

    return (
        <div className="relative h-screen w-full overflow-hidden bg-[var(--background)]">
            <nav
                className={[
                    'fixed top-3 z-40 flex h-10 -translate-x-1/2 items-center gap-1 overflow-hidden rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-2 text-sm shadow-lg backdrop-blur-xl',
                    navPositionClass,
                ].join(' ')}
            >
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

            <div
                className={[
                    'fixed top-3 z-40 flex items-center gap-2 transition-[right] duration-300 ease-out',
                    controlsRightClass,
                ].join(' ')}
            >
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-10 min-w-10 gap-0 -space-x-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-2 text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
                    aria-label={`${collaborators.length} collaborators`}
                >
                    {visibleCollaborators.map((member) => {
                        const displayName =
                            member.user.fullName ?? member.user.username

                        return (
                            <UserAvatar
                                key={member.id}
                                name={displayName}
                                src={member.user.avatarUrl}
                                className="h-7 w-7 border-2 border-[var(--surface)] text-[10px] font-semibold"
                                fallbackClassName="text-[var(--accent-foreground)]"
                                title={displayName}
                            />
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
                {!isPanelOpen ? (
                    <Tooltip delay={0}>
                        <Tooltip.Trigger className="inline-flex">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                className="h-10 w-10 min-w-10 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
                                onPress={handleOpenPanel}
                                aria-label={t('whiteboardPage.panel.openAriaLabel')}
                            >
                                <PanelRightOpen size={16} />
                            </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content
                            showArrow
                            placement="bottom"
                            offset={8}
                        >
                            <Tooltip.Arrow />
                            {t('whiteboardPage.panel.open')}
                        </Tooltip.Content>
                    </Tooltip>
                ) : null}
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

            <div className="flex h-full min-h-0">
                <div className="min-w-0 flex-1">
                    <WhiteboardCanvas
                        key={projectId}
                        elements={excalidrawElements}
                        viewportStorageKey={
                            projectId
                                ? `whiteboard:${projectId}:viewport`
                                : undefined
                        }
                        onChange={handleCanvasChange}
                        onPointerUp={handleCanvasPointerUp}
                    />
                </div>

                <div
                    className={[
                        'border-border bg-background hidden min-h-0 w-[26rem] shrink-0 border-l-2 xl:flex xl:flex-col',
                        showDockedPanel ? 'xl:translate-x-0 xl:opacity-100' : 'xl:hidden',
                    ].join(' ')}
                >
                    <WhiteboardWorkspacePanel
                        projectId={projectId}
                        isPinned
                        canDock={canDockPanel}
                        selectedTab={selectedPanelTab}
                        onTabChange={setSelectedPanelTab}
                        onTogglePin={handleTogglePanelPin}
                        onClose={handleClosePanel}
                        className="bg-background"
                        chromeClassName=""
                        bodyClassName="bg-background"
                        chatVariant="drawer"
                        templates={whiteboardTemplates}
                        onInsertTemplate={handleInsertTemplate}
                    />
                </div>
            </div>

            <div
                className={[
                    'fixed inset-y-0 right-0 z-40 w-[min(100vw,26rem)] transition-all duration-300 ease-out',
                    showDrawerPanel
                        ? 'translate-x-0 opacity-100'
                        : 'pointer-events-none translate-x-4 opacity-0',
                ].join(' ')}
            >
                <div className="border-border bg-background h-full overflow-hidden border-l shadow-[-12px_0_32px_rgba(15,23,42,0.08)]">
                    <WhiteboardWorkspacePanel
                        projectId={projectId}
                        isPinned={false}
                        canDock={canDockPanel}
                        selectedTab={selectedPanelTab}
                        onTabChange={setSelectedPanelTab}
                        onTogglePin={handleTogglePanelPin}
                        onClose={handleClosePanel}
                        className="bg-background"
                        chromeClassName=""
                        bodyClassName="bg-background"
                        chatVariant="drawer"
                        templates={whiteboardTemplates}
                        onInsertTemplate={handleInsertTemplate}
                    />
                </div>
            </div>
        </div>
    )
}
