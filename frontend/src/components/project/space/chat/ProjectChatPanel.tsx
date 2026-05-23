import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatPanelFrame } from './panel/ChatPanelFrame'
import { FloatingChatLauncher } from './panel/FloatingChatLauncher'

interface ProjectChatPanelProps {
    projectId: string
}

export function ProjectChatPanel({ projectId }: ProjectChatPanelProps) {
    const { t } = useTranslation('chat')

    const [isOpen, setIsOpen] = useState(false)
    const [isPinned, setIsPinned] = useState(false)

    const showDockedPanel = isOpen && isPinned
    const showFloatingPanel = isOpen && !isPinned

    function handleOpen() {
        setIsOpen(true)
        setIsPinned(false)
    }

    function handleClose() {
        setIsOpen(false)
        setIsPinned(false)
    }

    function handleTogglePin() {
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
                        canDock
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
                    canDock
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
