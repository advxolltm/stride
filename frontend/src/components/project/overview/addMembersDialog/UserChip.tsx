import { Avatar, Chip } from '@heroui/react'
import { X } from 'lucide-react'
import { getInitials } from '../../../../shared/utils'

interface UserChipProps {
    id: string
    displayName: string
    onRemove: (id: string) => void
}

export function UserChip({
    id,
    displayName,
    onRemove,
}: Readonly<UserChipProps>) {
    return (
        <Chip variant="soft" color="accent">
            <div className="flex items-center gap-1.5">
                <Avatar size="sm">
                    <Avatar.Fallback className="bg-accent text-xs text-white">
                        {getInitials(displayName)}
                    </Avatar.Fallback>
                </Avatar>
                <Chip.Label>{displayName.split(' ')[0]}</Chip.Label>
                <button onClick={() => onRemove(id)}>
                    <X size={16} />
                </button>
            </div>
        </Chip>
    )
}
