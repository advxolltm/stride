import { Button, Spinner, toast } from '@heroui/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '../../../shared/hooks/redux'
import { getApiErrorMessage } from '../../../shared/utils/api/errors'
import { useGetProjectsQuery } from '../../../store/features/project/project.api'
import {
    useSetAllWorkingHoursMutation,
} from '../../../store/features/user/user.api'
import { selectUserId } from '../../../store/userSlice'
import type { WorkingHoursAllocation } from '../../workingHours/types'
import { WorkingHoursAllocationCard } from '../../workingHours/WorkingHoursAllocationCard'
import { WorkingHoursSummaryCard } from '../../workingHours/WorkingHoursSummaryCard'
import {
    TOTAL_WEEKLY_HOURS,
    buildWorkingHoursAllocations,
} from '../../workingHours/workingHours.mappers'

export function WorkingHoursSection() {
    const { t } = useTranslation('setting')
    const userId = useAppSelector(selectUserId)
    const { data: projects = [], isLoading: isLoadingProjects } =
        useGetProjectsQuery()
    const [setAllWorkingHours, { isLoading: isSaving }] =
        useSetAllWorkingHoursMutation()
    const [draftHoursByProject, setDraftHoursByProject] = useState<
        Record<string, number>
    >({})

    const savedAllocations = useMemo(
        () =>
            userId
                ? buildWorkingHoursAllocations(projects, userId)
                : ([] as WorkingHoursAllocation[]),
        [projects, userId],
    )

    const allocations = useMemo<WorkingHoursAllocation[]>(
        () =>
            savedAllocations.map((allocation) => ({
                ...allocation,
                hours:
                    draftHoursByProject[allocation.id] ?? allocation.hours,
            })),
        [draftHoursByProject, savedAllocations],
    )

    const savedHoursByProject = useMemo(
        () =>
            Object.fromEntries(
                savedAllocations.map((allocation) => [
                    allocation.id,
                    allocation.hours,
                ]),
            ),
        [savedAllocations],
    )

    const allocated = useMemo(
        () => allocations.reduce((sum, item) => sum + item.hours, 0),
        [allocations],
    )
    const remaining = Math.max(TOTAL_WEEKLY_HOURS - allocated, 0)
    const isChanged = allocations.some(
        (allocation) =>
            allocation.hours !== savedHoursByProject[allocation.id],
    )

    function handleAllocationChange(projectId: string, nextHours: number) {
        setDraftHoursByProject((current) => {
            const target = allocations.find((item) => item.id === projectId)
            if (!target) return current

            const otherAllocated = allocations.reduce(
                (sum, item) =>
                    item.id === projectId ? sum : sum + item.hours,
                0,
            )
            const maxForProject = TOTAL_WEEKLY_HOURS - otherAllocated

            return {
                ...current,
                [projectId]: Math.max(0, Math.min(nextHours, maxForProject)),
            }
        })
    }

    const handleReset = () => {
        setDraftHoursByProject({})
    }

    const handleSave = async () => {
        if (!userId || !isChanged || isSaving) return

        try {
            await setAllWorkingHours({
                userId,
                body: allocations.map((allocation) => ({
                    project_id: allocation.id,
                    working_hours: allocation.hours,
                })),
            }).unwrap()
            setDraftHoursByProject({})
            toast.success(t('workingHours.updateSuccess'))
        } catch (error: unknown) {
            toast.danger(
                getApiErrorMessage(error, t('workingHours.updateError')),
            )
        }
    }

    if (isLoadingProjects) {
        return (
            <div className="flex min-h-40 items-center justify-center">
                <Spinner size="md" />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="font-semibold">{t('workingHours.title')}</h2>
                <p className="text-muted-foreground text-sm">
                    {t('workingHours.description')}
                </p>
            </div>

            <WorkingHoursSummaryCard
                allocated={allocated}
                remaining={remaining}
                total={TOTAL_WEEKLY_HOURS}
                allocatedLabel={t('workingHours.summary.allocated')}
                remainingLabel={t('workingHours.summary.remaining')}
            />

            <div className="flex flex-col gap-4">
                {allocations.map((allocation) => {
                    const otherAllocated = allocated - allocation.hours
                    const maxForProject = TOTAL_WEEKLY_HOURS - otherAllocated

                    return (
                        <WorkingHoursAllocationCard
                            key={allocation.id}
                            title={allocation.name}
                            subtitle={t('workingHours.projectSubtitle', {
                                hours: allocation.hours,
                                max: maxForProject,
                            })}
                            hours={allocation.hours}
                            maxHours={maxForProject}
                            initials={allocation.initials}
                            color={allocation.color}
                            inputAriaLabel={t(
                                'workingHours.inputAriaLabel',
                                {
                                    project: allocation.name,
                                },
                            )}
                            availabilityLabel={t(
                                'workingHours.availability',
                                {
                                    max: maxForProject,
                                },
                            )}
                            integerErrorLabel={t(
                                'workingHours.validation.integer',
                            )}
                            rangeErrorLabel={t(
                                'workingHours.validation.range',
                                {
                                    max: maxForProject,
                                },
                            )}
                            onChange={(hours) =>
                                handleAllocationChange(allocation.id, hours)
                            }
                        />
                    )
                })}

                {allocations.length === 0 && (
                    <div className="border-border bg-surface rounded-xl border p-6">
                        <p className="text-muted-foreground text-sm">
                            {t('skills.emptyProjects')}
                        </p>
                    </div>
                )}
            </div>

            {allocations.length > 0 && (
                <div className="flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        isDisabled={!isChanged || isSaving}
                        onPress={handleReset}
                    >
                        {t('workingHours.reset')}
                    </Button>
                    <Button
                        isDisabled={!isChanged || isSaving}
                        isPending={isSaving}
                        onPress={handleSave}
                    >
                        {t('workingHours.save')}
                    </Button>
                </div>
            )}
        </div>
    )
}
