import { Button, toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Home, Share2, Zap } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { WhiteboardCanvas } from '../components/project/space/whiteboard/WhiteboardCanvas'
import { getApiErrorMessage } from '../shared/utils/api/errors'
import { useGetProjectByIdQuery } from '../store/features/project/project.api'
import {
    useGetProjectWhiteboardElementsQuery,
    useGetProjectWhiteboardQuery,
} from '../store/features/whiteboard/whiteboard.api'
import getInitials from '../shared/utils/getInitials'

export function WhiteboardPage() {
    const { projectId } = useParams()
    const { t } = useTranslation('project')
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
        error: elementsError,
    } = useGetProjectWhiteboardElementsQuery(projectId ?? '', {
        skip: !projectId || !isWhiteboardReady,
    })

    const handleShare = async () => {
        const shareUrl = project?.joinLink ?? window.location.href

        try {
            await navigator.clipboard.writeText(shareUrl)
            toast.success(t('whiteboardPage.shareSuccess'))
        } catch {
            toast.danger(t('whiteboardPage.shareError'))
        }
    }

    if (!projectId) {
        return null
    }

    const isLoading =
        isProjectLoading || isWhiteboardLoading || isElementsLoading
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
    const excalidrawElements = [...whiteboardElements]
        .sort((left, right) => left.zIndex - right.zIndex)
        .map((element) => element.props)

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
                <ChevronRight size={14} className="shrink-0 text-[var(--muted)]" />
                <Link
                    to="/"
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                    aria-label={t('whiteboardPage.overviewAriaLabel')}
                >
                    <Home size={15} />
                    <span>{t('common:navigation.overview')}</span>
                </Link>
                <ChevronRight size={14} className="shrink-0 text-[var(--muted)]" />
                <Link
                    to={`/project/${projectId}`}
                    className="max-w-[160px] truncate rounded-full px-2 py-1 font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                >
                    {projectName}
                </Link>
                <ChevronRight size={14} className="shrink-0 text-[var(--muted)]" />
                <span className="rounded-full px-2 py-1 font-semibold text-[var(--foreground)]">
                    {t('spaces.whiteboard')}
                </span>
            </nav>

            <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
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

            <WhiteboardCanvas key={projectId} elements={excalidrawElements} />
        </div>
    )
}
