import { Button, Chip, Spinner, toast } from '@heroui/react'
import { skipToken } from '@reduxjs/toolkit/query'
import { Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ProjectSkillSelectionCard } from '../../../shared/ProjectSkillSelectionCard'
import { useAppSelector } from '../../../../shared/hooks/redux'
import { getApiErrorMessage } from '../../../../shared/utils/api/errors'
import type { Project } from '../../../../store/features/project/project.types'
import {
    useGetMyUserSkillsQuery,
    useUpdateUserProjectSkillsMutation,
} from '../../../../store/features/user/user.api'
import { selectUserId } from '../../../../store/userSlice'

interface MyProjectSkillsSettingsProps {
    project: Project
}

const haveSameSelections = (left: string[], right: string[]) => {
    const sortedLeft = [...left].sort()
    const sortedRight = [...right].sort()

    return (
        sortedLeft.length === sortedRight.length &&
        sortedLeft.every((value, index) => value === sortedRight[index])
    )
}

export function MyProjectSkillsSettings({
    project,
}: Readonly<MyProjectSkillsSettingsProps>) {
    const { t } = useTranslation('project')
    const userId = useAppSelector(selectUserId)
    const { data: userSkills = [], isLoading } = useGetMyUserSkillsQuery(
        userId ?? skipToken,
    )
    const [updateUserProjectSkills, { isLoading: isSaving }] =
        useUpdateUserProjectSkillsMutation()
    const [isEditing, setIsEditing] = useState(false)
    const [draftSelectedSkillIds, setDraftSelectedSkillIds] = useState<string[]>(
        [],
    )

    const selectedSkillIds = useMemo(
        () =>
            userSkills
                .filter(
                    (userSkill) =>
                        userSkill.projectSkill.projectId === project.id,
                )
                .map((userSkill) => userSkill.projectSkillId),
        [project.id, userSkills],
    )

    const selectedSkills = useMemo(
        () =>
            project.skills.filter((skill) =>
                selectedSkillIds.includes(skill.id),
            ),
        [project.skills, selectedSkillIds],
    )

    const isChanged = !haveSameSelections(
        draftSelectedSkillIds,
        selectedSkillIds,
    )

    const handleStartEditing = () => {
        setDraftSelectedSkillIds(selectedSkillIds)
        setIsEditing(true)
    }

    const handleCancel = () => {
        setDraftSelectedSkillIds(selectedSkillIds)
        setIsEditing(false)
    }

    const handleSave = async () => {
        if (!userId || !isChanged || isSaving) return

        try {
            await updateUserProjectSkills({
                userId,
                projectId: project.id,
                body: { project_skill_ids: draftSelectedSkillIds },
            }).unwrap()
            setIsEditing(false)
            toast.success(t('mySkillsSettings.saveSuccess'))
        } catch (error: unknown) {
            toast.danger(
                getApiErrorMessage(error, t('mySkillsSettings.saveError')),
            )
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
        <div className="flex h-full min-h-0 flex-col gap-8 p-2">
            <div className="flex shrink-0 items-start justify-between gap-3">
                <div>
                    <h2
                        className="text-base font-semibold"
                        style={{ color: 'var(--overlay-foreground)' }}
                    >
                        {t('mySkillsSettings.title')}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {t('mySkillsSettings.description')}
                    </p>
                </div>

                {!isEditing && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onPress={handleStartEditing}
                        className="gap-1.5"
                        style={{ color: 'var(--muted)' }}
                    >
                        <Pencil size={13} />
                        {t('mySkillsSettings.edit')}
                    </Button>
                )}
            </div>

            {!isEditing ? (
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 [scrollbar-gutter:auto]">
                    <div>
                        <p
                            className="mb-2 text-xs"
                            style={{ color: 'var(--muted)' }}
                        >
                            {t('mySkillsSettings.selectedLabel', {
                                selected: selectedSkills.length,
                                total: project.skills.length,
                            })}
                        </p>

                        {selectedSkills.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {selectedSkills.map((skill) => (
                                    <Chip key={skill.id} variant="soft">
                                        {skill.name}
                                    </Chip>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {t('mySkillsSettings.empty')}
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 [scrollbar-gutter:auto]">
                    <ProjectSkillSelectionCard
                        title={project.name}
                        skills={project.skills}
                        selectedSkillIds={draftSelectedSkillIds}
                        onChange={setDraftSelectedSkillIds}
                        label={t('mySkillsSettings.selectLabel')}
                        placeholder={t('mySkillsSettings.placeholder')}
                        searchPlaceholder={t(
                            'mySkillsSettings.searchPlaceholder',
                        )}
                        emptyStateMessage={t('mySkillsSettings.emptySkills')}
                        selectedLabel={t('mySkillsSettings.selectedLabel', {
                            selected: draftSelectedSkillIds.length,
                            total: project.skills.length,
                        })}
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onPress={handleCancel}
                            isDisabled={isSaving}
                        >
                            {t('mySkillsSettings.cancel')}
                        </Button>

                        <Button
                            variant="primary"
                            size="sm"
                            onPress={handleSave}
                            isPending={isSaving}
                            isDisabled={!isChanged}
                        >
                            {t('mySkillsSettings.save')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
