import { toast } from '@heroui/react'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
    ConfirmDialog,
    ProjectSettingsActionAlert,
} from '../../../shared/components'
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
            <ProjectSettingsActionAlert
                title={t('generalSettings.deleteTitle')}
                description={t('generalSettings.deleteDescription')}
                actionLabel={t('generalSettings.delete')}
                actionIcon={<Trash2 size={14} />}
                alertStatus="danger"
                buttonVariant="danger-soft"
                onAction={() => setIsDeleteDialogOpen(true)}
            />

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={t('generalSettings.deleteConfirmTitle')}
                message={t('generalSettings.deleteConfirmMessage', {
                    name: project.name,
                })}
                confirmLabel={t('generalSettings.deleteConfirm')}
                cancelLabel={t('generalSettings.deleteCancel')}
                confirmVariant="danger"
                isConfirmPending={isDeleting}
                onConfirm={handleConfirmDelete}
            />
        </>
    )
}
