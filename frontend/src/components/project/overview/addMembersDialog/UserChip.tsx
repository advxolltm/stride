import { Chip } from '@heroui/react'
import { X } from 'lucide-react'
import { UserAvatar } from '../../../../shared/components'

interface UserChipProps {
    id: string
    displayName: string
    avatarUrl?: string | null
    onRemove: (id: string) => void
}

export function UserChip({
    id,
    displayName,
    avatarUrl,
    onRemove,
}: Readonly<UserChipProps>) {
    return (
        <Chip variant="soft" color="accent">
            <div className="flex items-center gap-1.5">
                <UserAvatar
                    name={displayName}
                    src={avatarUrl}
                />
                <Chip.Label>{displayName.split(' ')[0]}</Chip.Label>
                <button onClick={() => onRemove(id)}>
                    <X size={16} />
                </button>
            </div>
        </Chip>
    )
}
