import { Button } from '@heroui/react'
import { UserAvatar } from '../../../../shared/components'
import type { ProjectMember } from '../../../../store/features/project/project.types'

interface CollaboratorsButtonProps {
    collaborators: readonly ProjectMember[]
    connectedCount: number
}

export function CollaboratorsButton({
    collaborators,
    connectedCount,
}: Readonly<CollaboratorsButtonProps>) {
    const visibleCollaborators = collaborators.slice(0, 3)
    const hiddenCollaborators = Math.max(collaborators.length - 3, 0)

    return (
        <Button
            size="sm"
            variant="ghost"
            className="h-10 min-w-10 gap-0 -space-x-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-2 text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
            aria-label={`${collaborators.length} collaborators, ${connectedCount} whiteboard users connected`}
        >
            {visibleCollaborators.map((member) => {
                const displayName = member.user.fullName ?? member.user.username

                return (
                    <UserAvatar
                        key={member.id}
                        name={displayName}
                        src={member.user.avatarUrl}
                        className="h-7 w-7 border-2 border-[var(--surface)] text-[10px] font-semibold"
                        fallbackClassName="text-[var(--accent-foreground)]"
                        title={displayName}
                    />
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
    )
}
