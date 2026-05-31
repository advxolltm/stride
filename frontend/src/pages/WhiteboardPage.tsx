import { Button, Tooltip } from '@heroui/react'
import { skipToken } from '@reduxjs/toolkit/query'
import {
    ChevronRight,
    Home,
    Moon,
    PanelRightOpen,
    Sun,
    Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArchivedReadOnlyChip } from '../components/project/space/shared/ArchivedReadOnlyChip'
import { CollaboratorsButton } from '../components/project/space/whiteboard/CollaboratorsButton'
import { WhiteboardCanvas } from '../components/project/space/whiteboard/canvas/WhiteboardCanvas'
import { useWhiteboardSync } from '../components/project/space/whiteboard/sync/useWhiteboardSync'
import { useWhiteboardTemplateInsertion } from '../components/project/space/whiteboard/sync/useWhiteboardTemplateInsertion'
import {
    whiteboardTemplates,
} from '../components/project/space/whiteboard/whiteboardTemplates'
import {
    WhiteboardWorkspacePanel,
    type WhiteboardPanelTab,
} from '../components/project/space/whiteboard/WhiteboardWorkspacePanel'
import { useAppDispatch, useAppSelector } from '../shared/hooks/redux'
import { getApiErrorMessage } from '../shared/utils/api/errors'
import { isProjectArchived } from '../shared/utils/projectStatus'
import { useGetProjectByIdQuery } from '../store/features/project/project.api'
import {
    useGetProjectWhiteboardElementsQuery,
    useGetProjectWhiteboardQuery,
    useWatchWhiteboardCursorQuery,
    useWatchWhiteboardEventsQuery,
} from '../store/features/whiteboard/whiteboard.api'
import type { WhiteboardLiveUpdateEventPayload } from '../store/features/whiteboard/whiteboard.socket.types'
import { toggleTheme } from '../store/themeSlice'
import { selectUserId } from '../store/userSlice'

const emptyLiveElementsById: Record<string, WhiteboardLiveUpdateEventPayload> =
    {}

const DOCK_MEDIA_QUERY = '(min-width: 1280px)'

export function WhiteboardPage() {
    const { projectId } = useParams()
    const { t } = useTranslation('project')
    const dispatch = useAppDispatch()
    const currentUserId = useAppSelector(selectUserId)
    const isDarkMode = useAppSelector((state) => state.theme.isDark)
    const [isPanelOpen, setIsPanelOpen] = useState(false)
    const [isPanelPinned, setIsPanelPinned] = useState(false)
    const [selectedPanelTab, setSelectedPanelTab] =
        useState<WhiteboardPanelTab>('chat')
    const [canDockPanel, setCanDockPanel] = useState(() =>
        typeof window !== 'undefined'
            ? window.matchMedia(DOCK_MEDIA_QUERY).matches
            : false,
    )
    const whiteboardCursorWS = useWatchWhiteboardCursorQuery(
        projectId ?? skipToken,
    )
    const whiteboardEventsWS = useWatchWhiteboardEventsQuery(
        projectId ?? skipToken,
        {
            selectFromResult: ({ data }) => ({
                liveElementsById: data?.liveElementsById ?? emptyLiveElementsById,
            }),
        },
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
    })
    const liveElementsById = whiteboardEventsWS.liveElementsById
    const isArchived = isProjectArchived(project)
    const {
        excalidrawElements,
        handleCanvasChange,
        handleCanvasPointerLeave,
        handleCanvasPointerUp,
        queueCursorUpdate,
    } = useWhiteboardSync({
        projectId,
        isReadOnly: isArchived,
        whiteboardElements,
        liveElementsById,
    })
    const { insertTemplate, insertingTemplateId, isInsertingTemplate } =
        useWhiteboardTemplateInsertion({
            projectId,
            isReadOnly: isArchived,
            whiteboardElements,
            refetchWhiteboardElements,
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
                {isArchived && <ArchivedReadOnlyChip />}
                <CollaboratorsButton
                    participants={presence}
                    currentUserId={currentUserId}
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
            </div>

            <div className="flex h-full min-h-0">
                <div className="min-w-0 flex-1">
                    <WhiteboardCanvas
                        key={projectId}
                        elements={excalidrawElements}
                        presence={remotePresence}
                        viewportStorageKey={
                            projectId
                                ? `whiteboard:${projectId}:viewport`
                                : undefined
                        }
                        viewModeEnabled={isArchived}
                        onChange={handleCanvasChange}
                        onPointerUp={handleCanvasPointerUp}
                        onCursorChange={queueCursorUpdate}
                        onCursorLeave={handleCanvasPointerLeave}
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
                        isReadOnly={isArchived}
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
                        isReadOnly={isArchived}
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
