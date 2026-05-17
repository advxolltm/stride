import { Button, Tooltip } from '@heroui/react'
import {
    MessageCircle,
    Pin,
    PinOff,
    SquareArrowOutUpRight,
    X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ChatSpace } from './ChatSpace'

interface ProjectChatPanelProps {
    projectId: string
}

const DOCK_MEDIA_QUERY = '(min-width: 1280px)'
const FLOATING_BUTTON_OFFSET_CLASS = 'bottom-6'
const FLOATING_PANEL_OFFSET_CLASS = 'bottom-[5.25rem]'

function HeaderActionButton({
    label,
    icon: Icon,
    onPress,
}: {
    label: string
    icon: LucideIcon
    onPress: () => void
}) {
    return (
        <Tooltip delay={0}>
            <Tooltip.Trigger className="inline-flex">
                <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={label}
                    onPress={onPress}
                >
                    <Icon size={18} />
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow placement="top" offset={8}>
                <Tooltip.Arrow />
                {label}
            </Tooltip.Content>
        </Tooltip>
    )
}

function ChatPanelFrame({
    projectId,
    isPinned,
    canDock,
    onTogglePin,
    onOpenFullChat,
    onClose,
    surfaceClassName,
}: {
    projectId: string
    isPinned: boolean
    canDock: boolean
    onTogglePin: () => void
    onOpenFullChat: () => void
    onClose: () => void
    surfaceClassName?: string
}) {
    const { t } = useTranslation('chat')

    return (
        <div
            className={[
                'flex h-full min-h-0 flex-col overflow-hidden',
                surfaceClassName ?? 'bg-background',
            ].join(' ')}
        >
            <div
                className={[
                    'border-border flex items-center justify-between gap-3 border-b px-4 py-3',
                    surfaceClassName === 'bg-surface'
                        ? 'bg-surface-secondary'
                        : 'bg-background',
                ].join(' ')}
            >
                <div className="min-w-0">
                    <div className="text-foreground truncate text-base font-semibold">
                        {t('chat.panel.subtitle')}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {canDock ? (
                        <HeaderActionButton
                            label={
                                isPinned
                                    ? t('chat.panel.unpin')
                                    : t('chat.panel.pin')
                            }
                            icon={isPinned ? PinOff : Pin}
                            onPress={onTogglePin}
                        />
                    ) : null}
                    <HeaderActionButton
                        label={t('chat.panel.openFull')}
                        icon={SquareArrowOutUpRight}
                        onPress={onOpenFullChat}
                    />
                    <HeaderActionButton
                        label={t('chat.panel.close')}
                        icon={X}
                        onPress={onClose}
                    />
                </div>
            </div>

            <ChatSpace
                projectId={projectId}
                variant="embedded"
            />
        </div>
    )
}

export function ProjectChatPanel({ projectId }: ProjectChatPanelProps) {
    const { t } = useTranslation('chat')
    const navigate = useNavigate()

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

    function handleOpenFullChat() {
        navigate(`/project/${projectId}/chat`)
    }

    return (
        <>
            <div
                className={[
                    `fixed right-6 ${FLOATING_PANEL_OFFSET_CLASS} z-40 w-[min(calc(100vw-2rem),24rem)] transition-all duration-300 ease-out`,
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
                        onOpenFullChat={handleOpenFullChat}
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
                    onOpenFullChat={handleOpenFullChat}
                    onClose={handleClose}
                    surfaceClassName="bg-surface"
                />
            </div>

            <div
                className={`pointer-events-none fixed right-6 ${FLOATING_BUTTON_OFFSET_CLASS} z-40`}
            >
                <Tooltip delay={0}>
                    <Tooltip.Trigger className="inline-flex">
                        <Button
                            isIconOnly
                            variant="secondary"
                            size="lg"
                            aria-label={t('chat.panel.open')}
                            className={[
                                'pointer-events-auto h-14 w-14 rounded-full shadow-[0_18px_40px_rgba(79,70,229,0.35)] transition-all duration-300 ease-out',
                                isOpen
                                    ? 'pointer-events-none translate-y-4 scale-95 opacity-0'
                                    : 'translate-y-0 scale-100 opacity-100',
                            ].join(' ')}
                            onPress={handleOpen}
                        >
                            <MessageCircle size={22} />
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content showArrow placement="left" offset={8}>
                        <Tooltip.Arrow />
                        {t('chat.panel.open')}
                    </Tooltip.Content>
                </Tooltip>
            </div>
        </>
    )
}
