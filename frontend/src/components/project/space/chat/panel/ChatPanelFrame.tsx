import { Pin, PinOff, SquareArrowOutUpRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChatSpace } from '../ChatSpace'
import { PanelActionButton } from '../../shared/PanelActionButton'
import { HeaderActionLink } from './HeaderActionLink'

interface ChatPanelFrameProps {
    projectId: string
    isPinned: boolean
    canDock: boolean
    isChatActive?: boolean
    onTogglePin: () => void
    onClose: () => void
    surfaceClassName?: string
}

export function ChatPanelFrame({
    projectId,
    isPinned,
    canDock,
    isChatActive = true,
    onTogglePin,
    onClose,
    surfaceClassName,
}: Readonly<ChatPanelFrameProps>) {
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
                        <PanelActionButton
                            label={
                                isPinned
                                    ? t('chat.panel.unpin')
                                    : t('chat.panel.pin')
                            }
                            icon={isPinned ? PinOff : Pin}
                            onPress={onTogglePin}
                        />
                    ) : null}
                    <HeaderActionLink
                        label={t('chat.panel.openFull')}
                        icon={SquareArrowOutUpRight}
                        to={`/project/${projectId}/chat`}
                    />
                    <PanelActionButton
                        label={t('chat.panel.close')}
                        icon={X}
                        onPress={onClose}
                    />
                </div>
            </div>

            <ChatSpace
                projectId={projectId}
                variant="embedded"
                isActive={isChatActive}
            />
        </div>
    )
}
