import { Button, toast } from '@heroui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../../shared/components'
import {
    useGetProjectSkillsQuery,
    useRemoveProjectSkillMutation,
} from '../../../../store/features/project/project.api'
import type {
    Project,
    ProjectSkill,
} from '../../../../store/features/project/project.types'
import { AddSkillForm } from './AddSkillForm'
import { SkillCard } from './SkillCard'

interface ProjectSkillsSettingsProps {
    isOwner: boolean
    project: Project
}

export function ProjectSkillsSettings({
    isOwner,
    project,
}: Readonly<ProjectSkillsSettingsProps>) {
    const { t } = useTranslation('project')
    const [isAdding, setIsAdding] = useState(false)
    const [skillToDelete, setSkillToDelete] = useState<ProjectSkill | null>(
        null,
    )

    //TODO: Should be removed once we have skills are part of the project details query
    const { data: skills = [], isLoading } = useGetProjectSkillsQuery(
        project.id,
    )

    const [removeSkill, { isLoading: isRemoving }] =
        useRemoveProjectSkillMutation()

    const handleConfirmDelete = async () => {
        if (!skillToDelete) return
        try {
            await removeSkill({
                projectId: project.id,
                skillId: skillToDelete.id,
            }).unwrap()
            toast.success(t('skillsSettings.deleteSuccess'))
        } catch {
            toast.danger(t('skillsSettings.deleteError'))
        }
    }

    return (
        <div className="flex flex-col gap-8 p-2">
            <div className="flex items-start justify-between">
                <div>
                    <h2
                        className="text-base font-semibold"
                        style={{ color: 'var(--overlay-foreground)' }}
                    >
                        {t('skillsSettings.title')}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {t('skillsSettings.description')}
                    </p>
                </div>

                {isOwner && !isAdding && (
                    <Button
                        variant="primary"
                        size="sm"
                        onPress={() => setIsAdding(true)}
                        className="gap-1.5"
                    >
                        <Plus size={14} />
                        {t('skillsSettings.addSkill')}
                    </Button>
                )}
            </div>

            {isOwner && isAdding && (
                <AddSkillForm
                    projectId={project.id}
                    onCancel={() => setIsAdding(false)}
                />
            )}

            {isLoading ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                    {t('skillsSettings.loading')}
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {skills.map((skill) => (
                        <SkillCard
                            key={skill.id}
                            name={skill.name}
                            description={skill.description}
                            isOwner={isOwner}
                            onDelete={() => setSkillToDelete(skill)}
                        />
                    ))}

                    {skills.length === 0 && !isAdding && (
                        <p className="py-4 text-center text-sm">
                            {t('skillsSettings.empty')}
                        </p>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={!!skillToDelete}
                onOpenChange={(open) => !open && setSkillToDelete(null)}
                title={t('skillsSettings.deleteTitle')}
                message={t('skillsSettings.deleteMessage', {
                    name: skillToDelete?.name,
                })}
                confirmLabel={t('skillsSettings.deleteConfirm')}
                pendingConfirmLabel={t('skillsSettings.deleteConfirmPending')}
                cancelLabel={t('skillsSettings.deleteCancel')}
                confirmVariant="danger"
                isConfirmPending={isRemoving}
                onConfirm={handleConfirmDelete}
            />
        </div>
    )
}
