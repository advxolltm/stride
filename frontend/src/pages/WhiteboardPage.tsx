import { Button, toast } from '@heroui/react'
import { ChevronRight, Home, Share2, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { WhiteboardCanvas } from '../components/project/space/whiteboard/WhiteboardCanvas'
import { useGetProjectByIdQuery } from '../store/features/project/project.api'
import { getInitials } from '../shared/utils/getInitials'

export function WhiteboardPage() {
    const { projectId } = useParams()
    const { data: project } = useGetProjectByIdQuery(projectId ?? '', {
        skip: !projectId,
    })
    const [isBarVisible, setIsBarVisible] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)
    const [isExcalidrawUiBlocking, setIsExcalidrawUiBlocking] =
        useState(false)
    const [title, setTitle] = useState('Whiteboard')
    const hideTimerRef = useRef<number | null>(null)

    const clearHideTimer = useCallback(() => {
        if (hideTimerRef.current) {
            window.clearTimeout(hideTimerRef.current)
            hideTimerRef.current = null
        }
    }, [])

    const hideBar = useCallback(() => {
        setIsBarVisible((prev) => (prev ? false : prev))
        clearHideTimer()
    }, [clearHideTimer])

    const scheduleHide = useCallback(() => {
        clearHideTimer()
        hideTimerRef.current = window.setTimeout(() => {
            setIsBarVisible(false)
        }, 2500)
    }, [clearHideTimer])

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            if (isDrawing || isExcalidrawUiBlocking) {
                hideBar()
                return
            }

            if (event.clientY <= 72) {
                setIsBarVisible(true)
                scheduleHide()
            }
        }

        window.addEventListener('pointermove', handlePointerMove)
        return () => {
            window.removeEventListener('pointermove', handlePointerMove)
            clearHideTimer()
        }
    }, [clearHideTimer, hideBar, isDrawing, isExcalidrawUiBlocking, scheduleHide])

    const handleDrawingChange = useCallback(
        (nextIsDrawing: boolean) => {
            setIsDrawing((prev) =>
                prev === nextIsDrawing ? prev : nextIsDrawing,
            )

            if (nextIsDrawing) {
                hideBar()
            }
        },
        [hideBar],
    )

    const handleUiBlockingChange = useCallback(
        (nextIsBlocking: boolean) => {
            setIsExcalidrawUiBlocking((prev) =>
                prev === nextIsBlocking ? prev : nextIsBlocking,
            )

            if (nextIsBlocking) {
                hideBar()
            }
        },
        [hideBar],
    )

    const handleShare = async () => {
        if (isExcalidrawUiBlocking) {
            hideBar()
            return
        }

        const shareUrl = project?.joinLink ?? window.location.href

        try {
            await navigator.clipboard.writeText(shareUrl)
            toast.success('Share link copied')
        } catch {
            toast.danger('Could not copy share link')
        }
    }

    if (!projectId) {
        return null
    }

    const projectName = project?.name ?? projectId
    const collaborators = project?.members ?? []
    const visibleCollaborators = collaborators.slice(0, 3)
    const hiddenCollaborators = Math.max(collaborators.length - 3, 0)

    return (
        <div className="relative h-screen w-full overflow-hidden bg-[var(--background)]">
            <div
                className={[
                    'pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-3 transition-all duration-300 ease-out',
                    isBarVisible && !isDrawing && !isExcalidrawUiBlocking
                        ? 'translate-y-0 opacity-100'
                        : '-translate-y-3 opacity-0',
                ].join(' ')}
            >
                <div className="pointer-events-auto flex h-11 w-full max-w-[calc(100vw-1rem)] items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_86%,transparent)] px-3 shadow-lg backdrop-blur-xl">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                        <Link
                            to="/"
                            className="flex h-8 shrink-0 items-center gap-2 rounded-md px-2 font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)]"
                            aria-label="Stride overview"
                        >
                            <span className="flex h-7 w-7 items-center justify-center rounded-[0.6rem] bg-[var(--accent)] text-[var(--accent-foreground)]">
                                <Zap size={17} strokeWidth={2.2} />
                            </span>
                            <span>Stride</span>
                        </Link>
                        <ChevronRight
                            size={14}
                            className="shrink-0 text-[var(--muted)]"
                        />
                        <Link
                            to="/"
                            className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                            aria-label="Overview"
                        >
                            <Home size={15} />
                            <span>Overview</span>
                        </Link>
                        <ChevronRight
                            size={14}
                            className="shrink-0 text-[var(--muted)]"
                        />
                        <Link
                            to={`/project/${projectId}`}
                            className="max-w-[180px] truncate font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                        >
                            {projectName}
                        </Link>
                        <ChevronRight
                            size={14}
                            className="shrink-0 text-[var(--muted)]"
                        />
                        <input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            onFocus={() => {
                                clearHideTimer()
                                setIsBarVisible(true)
                            }}
                            onBlur={() => {
                                setTitle((currentTitle) =>
                                    currentTitle.trim() || 'Whiteboard',
                                )
                                scheduleHide()
                            }}
                            className="h-8 min-w-0 max-w-[280px] rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-[var(--foreground)] outline-none transition-colors hover:border-[var(--border)] focus:border-[var(--accent)] focus:bg-[var(--surface)]"
                            aria-label="Whiteboard title"
                        />
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                        <div className="flex items-center -space-x-2">
                            {visibleCollaborators.map((member) => {
                                const displayName =
                                    member.user.fullName ??
                                    member.user.username

                                return (
                                    <div
                                        key={member.id}
                                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--accent)] text-[10px] font-semibold text-[var(--accent-foreground)]"
                                        title={displayName}
                                    >
                                        {getInitials(displayName)}
                                    </div>
                                )
                            })}
                            {hiddenCollaborators > 0 && (
                                <div className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-secondary)] px-1.5 text-[10px] font-semibold text-[var(--muted)]">
                                    +{hiddenCollaborators}
                                </div>
                            )}
                        </div>
                        <Button
                            size="sm"
                            variant="primary"
                            className="h-8 gap-1.5 px-3"
                            onPress={handleShare}
                        >
                            <Share2 size={14} />
                            Share
                        </Button>
                    </div>
                </div>
            </div>

            <WhiteboardCanvas
                projectId={projectId}
                onDrawingChange={handleDrawingChange}
                onUiBlockingChange={handleUiBlockingChange}
            />
        </div>
    )
}
