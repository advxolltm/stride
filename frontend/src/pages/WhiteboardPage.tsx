import { Button, Tooltip } from '@heroui/react'
import { skipToken } from '@reduxjs/toolkit/query'
import {
    ChevronLeft,
    ChevronRight,
    Home,
    Moon,
    PanelRightOpen,
    Sun,
    Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArchivedReadOnlyChip } from '../components/project/space/shared/ArchivedReadOnlyChip'
import { CollaboratorsButton } from '../components/project/space/whiteboard/CollaboratorsButton'
import { WhiteboardCanvas } from '../components/project/space/whiteboard/canvas/WhiteboardCanvas'
import type { WhiteboardFocusTarget } from '../components/project/space/whiteboard/canvas/whiteboardCanvas.types'
import { useWhiteboardSync } from '../components/project/space/whiteboard/sync/useWhiteboardSync'
import { useWhiteboardTemplateInsertion } from '../components/project/space/whiteboard/sync/useWhiteboardTemplateInsertion'
import { whiteboardTemplates } from '../components/project/space/whiteboard/whiteboardTemplates'
import {
    WhiteboardWorkspacePanel,
    type WhiteboardPanelTab,
} from '../components/project/space/whiteboard/WhiteboardWorkspacePanel'
import { useAppDispatch, useAppSelector } from '../shared/hooks/redux'
import useMediaQuery from '../shared/hooks/useMediaQuery'
import { getApiErrorMessage } from '../shared/utils/api/errors'
import { isProjectArchived } from '../shared/utils/projectStatus'
import { useGetProjectByIdQuery } from '../store/features/project/project.api'
import {
    useGetProjectWhiteboardElementsQuery,
    useGetProjectWhiteboardQuery,
    useWatchWhiteboardCursorQuery,
    useWatchWhiteboardEventsQuery,
} from '../store/features/whiteboard/whiteboard.api'
import type {
    WhiteboardCursorPresence,
    WhiteboardLiveUpdateEventPayload,
} from '../store/features/whiteboard/whiteboard.socket.types'
import { toggleTheme } from '../store/themeSlice'
import { selectUserId } from '../store/userSlice'
import { LinkTaskButton } from '../components/project/space/whiteboard/LinkTaskButton'
import type {
    NonDeletedExcalidrawElement,
    Ordered,
} from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { Task } from '../store/features/tasks/task.types'
import { ViewTaskButton } from '../components/project/space/whiteboard/ViewTaskButton'
import {
    createAndApplyNewLinkTaskGroup,
    searchSelectedTaskRegionID,
} from '../shared/utils/whiteboardTaskLinking/whiteboardTaskLinking'

const emptyLiveElementsById: Record<string, WhiteboardLiveUpdateEventPayload> =
    {}
const emptyRemoteSelectionClientIdsByElementId: Record<string, string[]> = {}

const DOCK_MEDIA_QUERY = '(min-width: 1280px)'

export function WhiteboardPage() {
    const { projectId } = useParams()
    const [searchParams, setSearchParams] = useSearchParams()
    const { t } = useTranslation('project')
    const dispatch = useAppDispatch()
    const currentUserId = useAppSelector(selectUserId)
    const isDarkMode = useAppSelector((state) => state.theme.isDark)
    const focusNonceRef = useRef(0)
    const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
    const [isPanelOpen, setIsPanelOpen] = useState(false)
    const [isPanelPinned, setIsPanelPinned] = useState(false)
    const [selectedPanelTab, setSelectedPanelTab] =
        useState<WhiteboardPanelTab>('chat')
    const [focusTarget, setFocusTarget] =
        useState<WhiteboardFocusTarget | null>(null)
    const [canDockPanel, setCanDockPanel] = useState(() =>
        typeof window !== 'undefined'
            ? window.matchMedia(DOCK_MEDIA_QUERY).matches
            : false,
    )
    const [isLinkTaskButtonVisible, setIsLinkTaskButtonVisible] =
        useState(false)
    const [viewTaskRegionTask, setViewTaskRegionTask] = useState<string | null>(
        null,
    )
    const whiteboardCursorWS = useWatchWhiteboardCursorQuery(
        projectId ?? skipToken,
    )
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
        refetchOnMountOrArgChange: true,
    })
    const whiteboardEventsWS = useWatchWhiteboardEventsQuery(
        projectId && isElementsReady ? projectId : skipToken,
        {
            selectFromResult: ({ data }) => ({
                liveElementsById:
                    data?.liveElementsById ?? emptyLiveElementsById,
                remoteSelectionClientIdsByElementId:
                    data?.remoteSelectionClientIdsByElementId ??
                    emptyRemoteSelectionClientIdsByElementId,
            }),
        },
    )
    const liveElementsById = whiteboardEventsWS.liveElementsById
    const remoteSelectionClientIdsByElementId =
        whiteboardEventsWS.remoteSelectionClientIdsByElementId
    const isArchived = isProjectArchived(project)
    const isXlOrLess = useMediaQuery('(max-width: 1279px)')
    const isReadOnly = isArchived || isXlOrLess
    const {
        excalidrawElements,
        handleCanvasChange,
        handleCanvasPointerUp,
        sendSelectionUpdate,
        queueCursorUpdate,
    } = useWhiteboardSync({
        projectId,
        isReadOnly,
        whiteboardElements,
        liveElementsById,
    })
    const { insertTemplate, insertingTemplateId, isInsertingTemplate } =
        useWhiteboardTemplateInsertion({
            projectId,
            isReadOnly,
            whiteboardElements,
            refetchWhiteboardElements,
            getExcalidrawApi: () => excalidrawApiRef.current,
        })

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

    function handleLinkTaskSelect(task: Task) {
        if (excalidrawApiRef.current) {
            createAndApplyNewLinkTaskGroup(excalidrawApiRef.current, task)
        }
    }

    function handleElementsSelected(
        elements: readonly Ordered<NonDeletedExcalidrawElement>[],
        groupedElements: readonly Ordered<NonDeletedExcalidrawElement>[],
        selectedOuterGroupIds: readonly string[],
    ): void {
        if (elements.length === 0) {
            setViewTaskRegionTask(null)
            setIsLinkTaskButtonVisible(false)
            return
        }

        const taskRegionID = searchSelectedTaskRegionID(
            elements,
            groupedElements,
            selectedOuterGroupIds,
        )
        if (taskRegionID) {
            setViewTaskRegionTask(taskRegionID)
            setIsLinkTaskButtonVisible(false)
        } else {
            setViewTaskRegionTask(null)
            setIsLinkTaskButtonVisible(true)
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

    function handleParticipantSelect(participant: WhiteboardCursorPresence) {
        if (participant.cursor.x === null || participant.cursor.y === null) {
            return
        }

        focusNonceRef.current += 1
        setFocusTarget({
            nonce: focusNonceRef.current,
            x: participant.cursor.x,
            y: participant.cursor.y,
        })
    }

    async function handleInsertTemplate(
        template: (typeof whiteboardTemplates)[number],
    ) {
        if (isInsertingTemplate) {
            return
        }

        const didInsert = await insertTemplate(template)

        if (didInsert && !isPanelPinned) {
            setIsPanelOpen(false)
        }
    }

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
    const presence = whiteboardCursorWS.data?.presence ?? []
    const remotePresence = currentUserId
        ? presence.filter((item) => item.user.id !== currentUserId)
        : presence
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
            {isXlOrLess ? (
                <nav className="fixed top-3 left-2 z-40 flex h-10 items-center rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-3 text-sm shadow-lg backdrop-blur-xl">
                    <Link
                        to={`/project/${projectId}`}
                        className="rounded-fullfont-medium flex h-8 shrink-0 items-center gap-1 text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)]"
                    >
                        <ChevronLeft size={16} />
                    </Link>
                </nav>
            ) : (
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
            )}

            <div
                className={[
                    'fixed top-3 z-40 flex items-center gap-2 transition-[right] duration-300 ease-out',
                    controlsRightClass,
                ].join(' ')}
            >
                {isArchived && <ArchivedReadOnlyChip />}
                {isLinkTaskButtonVisible && (
                    <LinkTaskButton onSelect={handleLinkTaskSelect} />
                )}
                {viewTaskRegionTask && (
                    <ViewTaskButton taskId={viewTaskRegionTask} />
                )}
                <CollaboratorsButton
                    participants={presence}
                    currentUserId={currentUserId}
                    onParticipantSelect={handleParticipantSelect}
                />
                <Tooltip delay={0}>
                    <Tooltip.Trigger className="inline-flex">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            className="h-10 w-10 min-w-10 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
                            onPress={() => dispatch(toggleTheme())}
                            aria-label={
                                isDarkMode
                                    ? t('whiteboardPage.theme.switchToLight')
                                    : t('whiteboardPage.theme.switchToDark')
                            }
                        >
                            {isDarkMode ? (
                                <Sun size={16} />
                            ) : (
                                <Moon size={16} />
                            )}
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content showArrow placement="bottom" offset={8}>
                        <Tooltip.Arrow />
                        {isDarkMode
                            ? t('whiteboardPage.theme.switchToLight')
                            : t('whiteboardPage.theme.switchToDark')}
                    </Tooltip.Content>
                </Tooltip>
                {!isPanelOpen ? (
                    <Tooltip delay={0}>
                        <Tooltip.Trigger className="inline-flex">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                className="h-10 w-10 min-w-10 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
                                onPress={handleOpenPanel}
                                aria-label={t(
                                    'whiteboardPage.panel.openAriaLabel',
                                )}
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
            </div>

            <div className="flex h-full min-h-0">
                <div className="min-w-0 flex-1">
                    <WhiteboardCanvas
                        ref={(excalidrawApi) => {
                            excalidrawApiRef.current = excalidrawApi
                            if (!excalidrawApiRef.current) {
                                return
                            }

                            const focusTaskId = searchParams.get('focusTaskId')
                            if (!focusTaskId) {
                                return
                            }

                            // NOTE: both the rectangle and the title above the rectangle have this id
                            // providing both to the scrollToContent(..., { fitToContent: true }) ensures
                            // that both (and by extension the actual content of the link) are properly in view
                            const targets = excalidrawElements.filter(
                                (e) => e.customData?.taskLinkId === focusTaskId,
                            )

                            if (targets.length > 0) {
                                excalidrawApiRef.current.scrollToContent(
                                    targets,
                                    {
                                        fitToViewport: true,
                                        viewportZoomFactor: 0.95,
                                    },
                                )
                            }

                            const nextParams = new URLSearchParams(searchParams)
                            nextParams.delete('focusTaskId')
                            setSearchParams(nextParams, { replace: true })
                        }}
                        key={projectId}
                        elements={excalidrawElements}
                        focusTarget={focusTarget}
                        presence={remotePresence}
                        remoteSelectionClientIdsByElementId={
                            remoteSelectionClientIdsByElementId
                        }
                        viewportStorageKey={
                            projectId
                                ? `whiteboard:${projectId}:viewport`
                                : undefined
                        }
                        viewModeEnabled={isReadOnly}
                        onChange={handleCanvasChange}
                        onPointerUp={handleCanvasPointerUp}
                        onCursorChange={queueCursorUpdate}
                        onSelectionChange={sendSelectionUpdate}
                        onElementsSelectedChanged={handleElementsSelected}
                    />
                </div>

                <div
                    className={[
                        'border-border bg-background hidden min-h-0 w-[26rem] shrink-0 border-l-2 xl:flex xl:flex-col',
                        showDockedPanel
                            ? 'xl:translate-x-0 xl:opacity-100'
                            : 'xl:hidden',
                    ].join(' ')}
                >
                    <WhiteboardWorkspacePanel
                        projectId={projectId}
                        isPinned
                        canDock={canDockPanel}
                        isReadOnly={isReadOnly}
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
                        insertingTemplateId={insertingTemplateId}
                        isInsertingTemplate={isInsertingTemplate}
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
                        isReadOnly={isReadOnly}
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
                        insertingTemplateId={insertingTemplateId}
                        isInsertingTemplate={isInsertingTemplate}
                    />
                </div>
            </div>
        </div>
    )
}
