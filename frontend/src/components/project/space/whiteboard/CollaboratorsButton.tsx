import { Button, Popover, Tooltip } from '@heroui/react'
import { LocateFixed, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '../../../../shared/components'
import type { WhiteboardCursorPresence } from '../../../../store/features/whiteboard/whiteboard.socket.types'

interface CollaboratorsButtonProps {
    participants: readonly WhiteboardCursorPresence[]
    currentUserId: string | null
    onParticipantSelect?: (participant: WhiteboardCursorPresence) => void
}

export function CollaboratorsButton({
    participants,
    currentUserId,
    onParticipantSelect,
}: Readonly<CollaboratorsButtonProps>) {
    const { t } = useTranslation('project')
    const [isOpen, setIsOpen] = useState(false)
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
    const participantsLabel = t(
        participants.length === 1
            ? 'whiteboardPage.participants.ariaLabel_one'
            : 'whiteboardPage.participants.ariaLabel_other',
        { count: participants.length },
    )

    function handleParticipantSelect(participant: WhiteboardCursorPresence) {
        onParticipantSelect?.(participant)
        setIsOpen(false)
    }

    return (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger>
                <Tooltip delay={0}>
                    <Tooltip.Trigger className="inline-flex">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-10 min-w-10 gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-2.5 text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
                            aria-label={participantsLabel}
                        >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] text-[var(--accent)]">
                                <Users size={15} strokeWidth={2.2} />
                            </span>
                            <span className="min-w-3 text-center text-sm font-semibold tabular-nums">
                                {participants.length}
                            </span>
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content showArrow placement="bottom" offset={8}>
                        <Tooltip.Arrow />
                        {participantsLabel}
                    </Tooltip.Content>
                </Tooltip>
            </Popover.Trigger>
            <Popover.Content
                className="mt-2 w-80 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-lg"
                placement="bottom end"
            >
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                            {t('whiteboardPage.participants.title')}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--muted)]">
                            {participantsLabel}
                        </div>
                    </div>
                    <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)] px-2 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                        {participants.length}
                    </span>
                </div>
                <div className="max-h-72 overflow-y-auto p-2">
                    {orderedParticipants.map((participant) => {
                        const isCurrentUser =
                            participant.user.id === currentUserId
                        const canSelectParticipant =
                            !isCurrentUser &&
                            participant.cursor.x !== null &&
                            participant.cursor.y !== null
                        const focusParticipantLabel = canSelectParticipant
                            ? t('whiteboardPage.participants.focusParticipant', {
                                  name: participant.user.name,
                              })
                            : undefined

                        const participantContent = (
                            <>
                                <UserAvatar
                                    name={participant.user.name}
                                    src={participant.user.avatarSmall}
                                    className="h-10 w-10 shrink-0 text-sm font-semibold"
                                    fallbackClassName="text-[var(--accent-foreground)]"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold">
                                        {participant.user.name}
                                    </div>
                                </div>
                                {isCurrentUser && (
                                    <span className="shrink-0 rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                                        {t('whiteboardPage.participants.you')}
                                    </span>
                                )}
                                {canSelectParticipant && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 shrink-0 gap-1.5 rounded-full border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface)]"
                                        aria-label={focusParticipantLabel}
                                        onPointerDown={(event) =>
                                            event.stopPropagation()
                                        }
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            handleParticipantSelect(participant)
                                        }}
                                    >
                                        <LocateFixed size={13} />
                                        {t('whiteboardPage.participants.jump')}
                                    </Button>
                                )}
                            </>
                        )

                        return canSelectParticipant ? (
                            <div
                                key={participant.user.id}
                                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-secondary)]"
                                onClick={() => handleParticipantSelect(participant)}
                            >
                                {participantContent}
                            </div>
                        ) : (
                            <div
                                key={participant.user.id}
                                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                            >
                                {participantContent}
                            </div>
                        )
                    })}
                </div>
            </Popover.Content>
        </Popover>
    )
}
