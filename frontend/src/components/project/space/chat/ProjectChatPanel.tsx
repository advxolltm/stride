import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatPanelFrame } from './panel/ChatPanelFrame'
import { FloatingChatLauncher } from './panel/FloatingChatLauncher'

interface ProjectChatPanelProps {
    projectId: string
}

const DOCK_MEDIA_QUERY = '(min-width: 1280px)'

export function ProjectChatPanel({ projectId }: ProjectChatPanelProps) {
    const { t } = useTranslation('chat')

    const [isOpen, setIsOpen] = useState(false)
    const [isPinned, setIsPinned] = useState(false)
    const [canDock, setCanDock] = useState(() =>
        typeof window !== 'undefined'
            ? window.matchMedia(DOCK_MEDIA_QUERY).matches
            : false,
    )

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const mediaQuery = window.matchMedia(DOCK_MEDIA_QUERY)
        const syncDockAvailability = (event?: MediaQueryListEvent) => {
            const matches = event?.matches ?? mediaQuery.matches
            setCanDock(matches)

            if (!matches) {
                setIsPinned(false)
            }
        }

        syncDockAvailability()
        mediaQuery.addEventListener('change', syncDockAvailability)

        return () => {
            mediaQuery.removeEventListener('change', syncDockAvailability)
        }
    }, [])

    const showDockedPanel = isOpen && isPinned && canDock
    const showFloatingPanel = isOpen && !showDockedPanel

    function handleOpen() {
        setIsOpen(true)
        setIsPinned(false)
    }

    function handleClose() {
        setIsOpen(false)
        setIsPinned(false)
    }

    function handleTogglePin() {
        if (!canDock) {
            return
        }

        setIsOpen(true)
        setIsPinned((current) => !current)
    }

    return (
        <>
            <div
                className={[
                    `fixed right-6 bottom-[5.25rem] z-40 w-[min(calc(100vw-2rem),24rem)] transition-all duration-300 ease-out`,
                    showFloatingPanel
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none translate-y-4 opacity-0',
                ].join(' ')}
            >
                <div className="border-border bg-surface h-[min(70vh,42rem)] overflow-hidden rounded-3xl border shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                    <ChatPanelFrame
                        projectId={projectId}
                        isPinned={false}
                        canDock={canDock}
                        onTogglePin={handleTogglePin}
                        onClose={handleClose}
                        surfaceClassName="bg-surface"
                    />
                </div>
            </div>

            <div
                className={[
                    'border-border bg-surface hidden min-h-0 w-[24rem] shrink-0 border-l-2 xl:flex xl:flex-col',
                    showDockedPanel ? 'xl:translate-x-0 xl:opacity-100' : 'xl:hidden',
                ].join(' ')}
            >
                <ChatPanelFrame
                    projectId={projectId}
                    isPinned
                    canDock={canDock}
                    onTogglePin={handleTogglePin}
                    onClose={handleClose}
                    surfaceClassName="bg-surface"
                />
            </div>

            <FloatingChatLauncher
                isOpen={isOpen}
                label={t('chat.panel.open')}
                offsetClassName="bottom-6"
                onOpen={handleOpen}
            />
        </>
    )
}
