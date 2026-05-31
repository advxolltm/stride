import { Button, Popover } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '../../../../shared/components'
import type { WhiteboardCursorPresence } from '../../../../store/features/whiteboard/whiteboard.socket.types'

interface CollaboratorsButtonProps {
    participants: readonly WhiteboardCursorPresence[]
    currentUserId: string | null
}

export function CollaboratorsButton({
    participants,
    currentUserId,
}: Readonly<CollaboratorsButtonProps>) {
    const { t } = useTranslation('project')
    const currentParticipant = currentUserId
        ? participants.find((participant) => participant.user.id === currentUserId)
        : undefined
    const orderedParticipants = currentParticipant
        ? [
              currentParticipant,
              ...participants.filter(
                  (participant) => participant.user.id !== currentUserId,
              ),
          ]
        : participants
    const visibleParticipants = orderedParticipants.slice(0, 3)
    const hiddenParticipants = Math.max(participants.length - 3, 0)

    return (
        <Popover>
            <Popover.Trigger>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-10 min-w-10 gap-0 -space-x-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-2 text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
                    aria-label={t(
                        'whiteboardPage.participants.ariaLabel',
                        { count: participants.length },
                    )}
                >
                    {visibleParticipants.map((participant) => (
                        <UserAvatar
                            key={participant.user.id}
                            name={participant.user.name}
                            src={participant.user.avatarSmall}
                            className="h-7 w-7 border-2 border-[var(--surface)] text-[10px] font-semibold"
                            fallbackClassName="text-[var(--accent-foreground)]"
                            title={participant.user.name}
                        />
                    ))}
                    {hiddenParticipants > 0 && (
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface)] px-1 text-[10px] font-semibold text-[var(--muted)]">
                            +{hiddenParticipants}
                        </span>
                    )}
                    {participants.length === 0 && (
                        <span className="px-1.5 text-sm font-medium text-[var(--muted)]">
                            0
                        </span>
                    )}
                </Button>
            </Popover.Trigger>
            <Popover.Content
                className="mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-lg"
                placement="bottom end"
            >
                <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">
                    {t('whiteboardPage.participants.title')}
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                    {orderedParticipants.map((participant) => {
                        const isCurrentUser =
                            participant.user.id === currentUserId

                        return (
                            <div
                                key={participant.user.id}
                                className="flex items-center gap-3 px-4 py-2.5"
                            >
                                <UserAvatar
                                    name={participant.user.name}
                                    src={participant.user.avatarSmall}
                                    className="h-8 w-8 text-xs font-semibold"
                                    fallbackClassName="text-[var(--accent-foreground)]"
                                />
                                <div className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {participant.user.name}
                                </div>
                                {isCurrentUser && (
                                    <span className="shrink-0 text-xs font-medium text-[var(--muted)]">
                                        {t('whiteboardPage.participants.you')}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                    {participants.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                            {t('whiteboardPage.participants.empty')}
                        </div>
                    )}
                </div>
            </Popover.Content>
        </Popover>
    )
}
