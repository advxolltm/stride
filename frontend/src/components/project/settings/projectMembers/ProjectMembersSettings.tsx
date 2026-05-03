import { Button, toast } from '@heroui/react'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../../shared/components'
import { useGetSessionQuery } from '../../../../store/features/auth/auth.api'
import { useRemoveProjectMemberMutation } from '../../../../store/features/project/project.api'
import type {
    Project,
    ProjectMember,
} from '../../../../store/features/project/project.types'
import { AddMembersDialog } from '../../overview/addMembersDialog/AddMembersDialog'
import { MemberCard } from './MemberCard'

interface ProjectMembersSettingsProps {
    isOwner: boolean
    project: Project
}

export function ProjectMembersSettings({
    isOwner,
    project,
}: Readonly<ProjectMembersSettingsProps>) {
    const { t } = useTranslation('project')
    const { data: sessionUser } = useGetSessionQuery()
    const [isInviteOpen, setIsInviteOpen] = useState(false)
    const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(
        null,
    )

    const [removeMember, { isLoading: isRemoving }] =
        useRemoveProjectMemberMutation()

    const handleConfirmRemove = async () => {
        if (!memberToRemove) return
        try {
            await removeMember({
                projectId: project.id,
                memberId: memberToRemove.userId,
            }).unwrap()
            toast.success(t('membersSettings.removeSuccess'))
        } catch {
            toast.danger(t('membersSettings.removeError'))
        }
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 p-2">
            <div className="flex shrink-0 items-center justify-between gap-3">
                <h2
                    className="text-base font-semibold"
                    style={{ color: 'var(--overlay-foreground)' }}
                >
                    {t('membersSettings.title')}
                </h2>

                {isOwner && (
                    <Button
                        onPress={() => setIsInviteOpen(true)}
                        className="flex items-center gap-2"
                    >
                        <UserPlus size={16} />
                        {t('membersSettings.add')}
                    </Button>
                )}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-gutter:auto]">
                {project.members.map((member) => (
                    <MemberCard
                        key={member.id}
                        role={member.role}
                        isOwner={isOwner}
                        onDelete={() => setMemberToRemove(member)}
                        name={member.user.fullName ?? member.user.username}
                        email={member.user.email}
                    />
                ))}
            </div>

            <ConfirmDialog
                isOpen={!!memberToRemove}
                onOpenChange={(open) => !open && setMemberToRemove(null)}
                title={t('membersSettings.removeTitle')}
                message={t('membersSettings.removeMessage')}
                confirmLabel={t('membersSettings.removeConfirm')}
                pendingConfirmLabel={t('membersSettings.removeConfirmPending')}
                cancelLabel={t('membersSettings.removeCancel')}
                confirmVariant="danger"
                isConfirmPending={isRemoving}
                onConfirm={handleConfirmRemove}
            />

            <AddMembersDialog
                isOpen={isInviteOpen}
                setIsOpen={setIsInviteOpen}
                projectId={project.id}
                projectName={project.name}
                existingMemberIds={project.members.map(
                    (member) => member.userId,
                )}
                currentUserId={sessionUser?.id ?? ''}
            />
        </div>
    )
}
