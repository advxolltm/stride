import { Avatar, Button, Chip } from '@heroui/react'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const mockMembers = [
    {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'owner',
        initials: 'JD',
    },
    {
        id: 2,
        name: 'Sarah Chen',
        email: 'sarah@example.com',
        role: 'member',
        initials: 'SC',
    },
    {
        id: 3,
        name: 'Alex Rivera',
        email: 'alex@example.com',
        role: 'member',
        initials: 'AR',
    },
]

export function ProjectMembersSettings({ isOwner }: { isOwner: boolean }) {
    const { t } = useTranslation("project")

    return (
        <div className="flex flex-col gap-4 p-2">
            <div className="flex items-center justify-between">
                <h2
                    className="text-base font-semibold"
                    style={{ color: 'var(--overlay-foreground)' }}
                >
                    {t('membersSettings.title')}
                </h2>
            </div>

            <div className="space-y-2">
                {mockMembers.map((member) => (
                    <div
                        key={member.id}
                        className="group flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:[background:var(--surface-secondary)]"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <Avatar.Fallback className="bg-accent text-white">
                                    {member.initials}
                                </Avatar.Fallback>
                            </Avatar>

                            <div>
                                <p
                                    className="text-sm font-medium"
                                    style={{
                                        color: 'var(--overlay-foreground)',
                                    }}
                                >
                                    {member.name}
                                </p>

                                <p
                                    className="text-xs"
                                    style={{ color: 'var(--muted)' }}
                                >
                                    {member.email}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {member.role === 'owner' ? (
                                <Chip
                                    variant="primary"
                                    color="accent"
                                    size="sm"
                                    className="px-2"
                                >
                                    {t('membersSettings.owner')}
                                </Chip>
                            ) : (
                                <Chip
                                    variant="soft"
                                    color="accent"
                                    size="sm"
                                    className="px-2"
                                >
                                    {t('membersSettings.member')}
                                </Chip>
                            )}

                            {isOwner && member.role !== 'owner' && (
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="danger-soft"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
