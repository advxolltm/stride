import { Alert, Button, toast } from '@heroui/react'
import { Archive, ArchiveRestore } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../shared/components'
import { useUpdateProjectMutation } from '../../../store/features/project/project.api'
import type { Project } from '../../../store/features/project/project.types'

interface ProjectGeneralSettingsArchiveProps {
    project: Project
}

export function ProjectGeneralSettingsArchive({
    project,
}: Readonly<ProjectGeneralSettingsArchiveProps>) {
    const { t } = useTranslation('project')
    const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
    const isArchived = project.status === 'archived'
    const [updateProject, { isLoading: isArchiving }] =
        useUpdateProjectMutation()
    const actionLabel = t(
        isArchived ? 'projectCard.unarchive' : 'projectCard.archive',
    )
    const title = t(
        isArchived
            ? 'generalSettings.unarchiveTitle'
            : 'generalSettings.archiveTitle',
    )
    const description = t(
        isArchived
            ? 'generalSettings.unarchiveDescription'
            : 'generalSettings.archiveDescription',
    )
    const confirmTitle = t(
        isArchived
            ? 'projectCard.unarchiveConfirmTitle'
            : 'projectCard.archiveConfirmTitle',
    )
    const confirmMessage = t(
        isArchived
            ? 'projectCard.unarchiveConfirmMessage'
            : 'projectCard.archiveConfirmMessage',
        { name: project.name },
    )
    const confirmLabel = t(
        isArchived
            ? 'projectCard.unarchiveConfirm'
            : 'projectCard.archiveConfirm',
    )
    const pendingConfirmLabel = t(
        isArchived
            ? 'projectCard.unarchiveConfirmPending'
            : 'projectCard.archiveConfirmPending',
    )

    const handleConfirmArchive = async () => {
        const nextStatus = isArchived ? 'active' : 'archived'

        try {
            await updateProject({
                projectId: project.id,
                body: {
                    status: nextStatus,
                },
            }).unwrap()
            toast.success(
                t(
                    isArchived
                        ? 'projectCard.unarchiveSuccess'
                        : 'projectCard.archiveSuccess',
                ),
            )
        } catch {
            toast.danger(
                t(
                    isArchived
                        ? 'projectCard.unarchiveError'
                        : 'projectCard.archiveError',
                ),
            )
        }
    }

    return (
        <>
            <div className="border-t pt-6">
                <Alert className="flex items-center rounded-xl border">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>{title}</Alert.Title>
                        <Alert.Description>{description}</Alert.Description>
                    </Alert.Content>
                    <Button
                        variant="outline"
                        size="sm"
                        onPress={() => setIsArchiveDialogOpen(true)}
                        className="ml-auto shrink-0"
                    >
                        {isArchived ? (
                            <ArchiveRestore size={14} />
                        ) : (
                            <Archive size={14} />
                        )}
                        {actionLabel}
                    </Button>
                </Alert>
            </div>

            <ConfirmDialog
                isOpen={isArchiveDialogOpen}
                onOpenChange={setIsArchiveDialogOpen}
                title={confirmTitle}
                message={confirmMessage}
                confirmLabel={confirmLabel}
                pendingConfirmLabel={pendingConfirmLabel}
                cancelLabel={t('generalSettings.deleteCancel')}
                isConfirmPending={isArchiving}
                onConfirm={handleConfirmArchive}
            />
        </>
    )
}
