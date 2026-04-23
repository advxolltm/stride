import { toast } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../../shared/components'
import { useRemoveProjectMemberMutation } from '../../../../store/features/project/project.api'
import type {
    Project,
    ProjectMember,
} from '../../../../store/features/project/project.types'
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
        <div className="flex flex-col gap-4 p-2">
            <h2
                className="text-base font-semibold"
                style={{ color: 'var(--overlay-foreground)' }}
            >
                {t('membersSettings.title')}
            </h2>

            <div className="space-y-2">
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
        </div>
    )
}
