import { Alert, Button, toast } from '@heroui/react'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { ConfirmDialog } from '../../../shared/components'
import { useDeleteProjectMutation } from '../../../store/features/project/project.api'
import type { Project } from '../../../store/features/project/project.types'

interface ProjectGeneralSettingsDeleteProps {
    project: Project
}

export function ProjectGeneralSettingsDelete({
    project,
}: Readonly<ProjectGeneralSettingsDeleteProps>) {
    const { t } = useTranslation('project')
    const navigate = useNavigate()
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleteProject, { isLoading: isDeleting }] =
        useDeleteProjectMutation()

    const handleConfirmDelete = async () => {
        try {
            await deleteProject(project.id).unwrap()
            toast.success(t('generalSettings.deleteSuccess'))
            navigate('/')
        } catch {
            toast.danger(t('generalSettings.deleteError'))
        }
    }

    return (
        <>
            <div className="border-t pt-6">
                <Alert className="rounded-xl border" status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>
                            {t('generalSettings.deleteTitle')}
                        </Alert.Title>
                        <Alert.Description>
                            {t('generalSettings.deleteDescription')}
                        </Alert.Description>
                    </Alert.Content>
                    <Button
                        variant="danger-soft"
                        size="sm"
                        onPress={() => setIsDeleteDialogOpen(true)}
                        className="ml-auto shrink-0"
                    >
                        <Trash2 size={14} />
                        {t('generalSettings.delete')}
                    </Button>
                </Alert>
            </div>

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={t('generalSettings.deleteConfirmTitle')}
                message={t('generalSettings.deleteConfirmMessage', {
                    name: project.name,
                })}
                confirmLabel={t('generalSettings.deleteConfirm')}
                pendingConfirmLabel={t('generalSettings.deleteConfirmPending')}
                cancelLabel={t('generalSettings.deleteCancel')}
                confirmVariant="danger"
                isConfirmPending={isDeleting}
                onConfirm={handleConfirmDelete}
            />
        </>
    )
}
