import { Button, Spinner, toast } from '@heroui/react'
import { skipToken } from '@reduxjs/toolkit/query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getApiErrorMessage } from '../../../shared/utils/api/errors'
import { useAppSelector } from '../../../shared/hooks/redux'
import { useGetProjectsQuery } from '../../../store/features/project/project.api'
import {
    useGetMyUserSkillsQuery,
    useUpdateUserProjectSkillsMutation,
} from '../../../store/features/user/user.api'
import { selectUserId } from '../../../store/userSlice'
import { ProjectSkillsCard } from './ProjectSkillsCard'

/**
 * Checks whether the current selection contains
 * the same items as the initial selection,
 * regardless of order.
 */
const haveSameSelections = (
    currentSelection: string[],
    initialSelection: string[],
) => {
    const sortedCurrent = [...currentSelection].sort()
    const sortedInitial = [...initialSelection].sort()

    return (
        sortedCurrent.length === sortedInitial.length &&
        sortedCurrent.every((value, index) => value === sortedInitial[index])
    )
}

export function SkillsSection() {
    const { t } = useTranslation('setting')
    const userId = useAppSelector(selectUserId)
    const { data: projects = [], isLoading: isLoadingProjects } =
        useGetProjectsQuery()
    const { data: userSkills = [], isLoading: isLoadingUserSkills } =
        useGetMyUserSkillsQuery(userId ?? skipToken)
    const [updateProjectSkills, { isLoading: isSaving }] =
        useUpdateUserProjectSkillsMutation()

    // Maps project IDs to the initially selected skill IDs for that project.
    const initialSelectedByProject = useMemo(() => {
        const next: Record<string, string[]> = {}

        for (const project of projects) {
            next[project.id] = []
        }

        for (const userSkill of userSkills) {
            const projectId = userSkill.projectSkill.projectId
            if (next[projectId]) {
                next[projectId].push(userSkill.projectSkillId)
            }
        }

        return next
    }, [projects, userSkills])

    // Maps project IDs to the currently selected skill IDs for that project.
    const [draftSelectedByProject, setDraftSelectedByProject] = useState<
        Record<string, string[]>
    >({})

    // Combines the initial and draft selections to determine the currently selected skill IDs for each project.
    const selectedByProject = useMemo(() => {
        const next = { ...initialSelectedByProject }

        for (const [projectId, values] of Object.entries(
            draftSelectedByProject,
        )) {
            next[projectId] = values
        }

        return next
    }, [draftSelectedByProject, initialSelectedByProject])

    // Determines which projects have changes in their selected skills compared to the initial selection.
    const changedProjectIds = projects
        .filter(
            (project) =>
                !haveSameSelections(
                    selectedByProject[project.id] ?? [],
                    initialSelectedByProject[project.id] ?? [],
                ),
        )
        .map((project) => project.id)

    const isChanged = changedProjectIds.length > 0
    const isLoading = isLoadingProjects || isLoadingUserSkills

    const handleChange = (projectId: string, values: string[]) => {
        setDraftSelectedByProject((prev) => {
            if (
                haveSameSelections(
                    values,
                    initialSelectedByProject[projectId] ?? [],
                )
            ) {
                const next = { ...prev }
                delete next[projectId]
                return next
            }

            return {
                ...prev,
                [projectId]: values,
            }
        })
    }

    const handleReset = () => {
        setDraftSelectedByProject({})
    }

    const handleSave = async () => {
        if (!userId || !isChanged || isSaving) return

        try {
            for (const projectId of changedProjectIds) {
                await updateProjectSkills({
                    userId,
                    projectId,
                    body: {
                        project_skill_ids: selectedByProject[projectId] ?? [],
                    },
                }).unwrap()
            }

            setDraftSelectedByProject({})
            toast.success(t('skills.updateSuccess'))
        } catch (error: unknown) {
            toast.danger(getApiErrorMessage(error, t('skills.updateError')))
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-40 items-center justify-center">
                <Spinner size="md" />
            </div>
        )
    }

    return (
        <div className="relative flex flex-col gap-6">
            {isSaving && (
                <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center rounded-lg">
                    <Spinner size="md" />
                </div>
            )}

            <div>
                <h2 className="font-semibold">{t('skills.title')}</h2>
                <p className="text-muted-foreground text-sm">
                    {t('skills.description')}
                </p>
            </div>

            <div className="flex flex-col gap-4">
                {projects.map((project) => (
                    <ProjectSkillsCard
                        key={project.id}
                        project={{
                            id: project.id,
                            name: project.name,
                            skills: project.skills ?? [],
                            selected: selectedByProject[project.id] ?? [],
                        }}
                        label={t('skills.selectLabel')}
                        placeholder={t('skills.placeholder')}
                        searchPlaceholder={t('skills.searchPlaceholder')}
                        emptyStateMessage={t('skills.emptySkills')}
                        selectedLabel={t('skills.selectedCount', {
                            selected:
                                selectedByProject[project.id]?.length ?? 0,
                            total: project.skills?.length ?? 0,
                        })}
                        onChange={(values) => handleChange(project.id, values)}
                    />
                ))}

                {projects.length === 0 && (
                    <div className="border-border bg-surface rounded-xl border p-6">
                        <p className="text-muted-foreground text-sm">
                            {t('skills.emptyProjects')}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3">
                <Button
                    variant="ghost"
                    isDisabled={!isChanged || isSaving}
                    onPress={handleReset}
                >
                    {t('skills.reset')}
                </Button>
                <Button
                    isDisabled={!isChanged || isSaving}
                    onPress={handleSave}
                >
                    {t('skills.save')}
                </Button>
            </div>
        </div>
    )
}
