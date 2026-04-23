import { Avatar, Button, Chip } from '@heroui/react'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getInitials } from '../../../../shared/utils'

interface MemberCardProps {
    name: string
    email: string
    role: 'owner' | 'member'
    isOwner: boolean
    onDelete: () => void
}

export function MemberCard({
    name,
    email,
    role,
    isOwner,
    onDelete,
}: Readonly<MemberCardProps>) {
    const { t } = useTranslation('project')

    return (
        <div
            className="group flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
            style={{ borderColor: 'var(--border)' }}
        >
            <div className="flex items-center gap-3">
                <Avatar>
                    <Avatar.Fallback className="bg-accent text-white">
                        {getInitials(name)}
                    </Avatar.Fallback>
                </Avatar>
                <div>
                    <p
                        className="text-sm font-medium"
                        style={{ color: 'var(--overlay-foreground)' }}
                    >
                        {name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {email}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Chip
                    variant={role === 'owner' ? 'primary' : 'soft'}
                    color="accent"
                    size="sm"
                >
                    {role === 'owner'
                        ? t('membersSettings.owner')
                        : t('membersSettings.member')}
                </Chip>

                {isOwner && role !== 'owner' && (
                    <Button isIconOnly variant="ghost" onClick={onDelete}>
                        <Trash2 />
                    </Button>
                )}
            </div>
        </div>
    )
}
