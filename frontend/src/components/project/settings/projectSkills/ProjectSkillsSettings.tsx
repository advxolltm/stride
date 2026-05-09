import { Button, toast } from '@heroui/react'
import { Inbox, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../../shared/components'
import {
    useAddProjectSkillMutation,
    useGetProjectsQuery,
    useRemoveProjectSkillMutation,
} from '../../../../store/features/project/project.api'
import type {
    Project,
    ProjectSkill,
} from '../../../../store/features/project/project.types'
import { AddProjectSkillPanel } from './AddProjectSkillPanel'
import { CurrentSkillsList } from './CurrentSkillsList'
import type { ProjectSkillInput } from './skillUtils'
import { getAddedSkillNames } from './skillUtils'

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
    const { data: projects = [] } = useGetProjectsQuery()
    const [createProjectSkill, { isLoading: isCreatingProjectSkill }] =
        useAddProjectSkillMutation()
    const [removeSkill, { isLoading: isRemoving }] =
        useRemoveProjectSkillMutation()
    const skills = project.skills ?? []
    const addedSkillNames = getAddedSkillNames(skills)

    const addProjectSkill = async (skill: ProjectSkillInput) => {
        try {
            await createProjectSkill({
                projectId: project.id,
                body: {
                    name: skill.name,
                    description: skill.description,
                },
            }).unwrap()
            toast.success(t('skillsSettings.addSuccess'))
        } catch {
            toast.danger(t('skillsSettings.addError'))
        }
    }

    const addProjectSkills = async (skillsToAdd: ProjectSkillInput[]) => {
        if (skillsToAdd.length === 0) return

        try {
            await Promise.all(
                skillsToAdd.map((skill) =>
                    createProjectSkill({
                        projectId: project.id,
                        body: {
                            name: skill.name,
                            description: skill.description,
                        },
                    }).unwrap(),
                ),
            )
            toast.success(t('skillsSettings.addAllSuccess'))
        } catch {
            toast.danger(t('skillsSettings.addError'))
        }
    }

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
        <div className="flex h-full min-h-0 flex-col gap-6 p-2">
            <div className="flex shrink-0 items-start justify-between gap-3">
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

            {isOwner && isAdding ? (
                <div className="grid min-h-0 flex-1 grid-rows-[minmax(420px,3fr)_minmax(280px,2fr)] gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] xl:grid-rows-none">
                    <div className="min-h-0">
                        <AddProjectSkillPanel
                            project={project}
                            projects={projects}
                            addedSkillNames={addedSkillNames}
                            isCreatingProjectSkill={isCreatingProjectSkill}
                            addProjectSkill={addProjectSkill}
                            addProjectSkills={addProjectSkills}
                            onDone={() => setIsAdding(false)}
                        />
                    </div>

                    <div className="min-h-0 overflow-y-auto pr-1 [scrollbar-gutter:auto]">
                        {skills.length > 0 ? (
                            <CurrentSkillsList
                                skills={skills}
                                isOwner={isOwner}
                                isAddingCustom={isAdding}
                                emptyLabel={t('skillsSettings.empty')}
                                onDelete={setSkillToDelete}
                            />
                        ) : (
                            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center text-sm">
                                <Inbox size={28} />
                                <p>{t('skillsSettings.empty')}</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:auto]">
                    <CurrentSkillsList
                        skills={skills}
                        isOwner={isOwner}
                        isAddingCustom={isAdding}
                        emptyLabel={t('skillsSettings.empty')}
                        onDelete={setSkillToDelete}
                    />
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
                cancelLabel={t('skillsSettings.deleteCancel')}
                confirmVariant="danger"
                isConfirmPending={isRemoving}
                onConfirm={handleConfirmDelete}
            />
        </div>
    )
}
