import { Spinner } from '@heroui/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Project } from '../../../../store/features/project/project.types'
import {
    TOTAL_WEEKLY_HOURS,
    buildMockWorkingHoursAllocations,
} from '../../../workingHours/mockWorkingHours'
import { WorkingHoursAllocationCard } from '../../../workingHours/WorkingHoursAllocationCard'
import { WorkingHoursSummaryCard } from '../../../workingHours/WorkingHoursSummaryCard'
import { useGetProjectsQuery } from '../../../../store/features/project/project.api'
import type { WorkingHoursAllocation } from '../../../workingHours/types'

interface MyProjectWorkingHoursSettingsProps {
    project: Project
}

export function MyProjectWorkingHoursSettings({
    project,
}: Readonly<MyProjectWorkingHoursSettingsProps>) {
    const { t } = useTranslation('project')
    const { data: projects = [], isLoading } = useGetProjectsQuery()
    const allocations = useMemo<WorkingHoursAllocation[]>(
        () => buildMockWorkingHoursAllocations(projects),
        [projects],
    )

    const initialCurrentProject = useMemo(
        () =>
            allocations.find((item) => item.id === project.id) ?? {
                id: project.id,
                name: project.name,
                initials: project.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase(),
                hours: TOTAL_WEEKLY_HOURS,
                color: '#4f46e5',
            },
        [allocations, project.id, project.name],
    )

    const otherProjects = useMemo(
        () => allocations.filter((item) => item.id !== project.id),
        [allocations, project.id],
    )

    const otherCommittedHours = useMemo(
        () => otherProjects.reduce((sum, item) => sum + item.hours, 0),
        [otherProjects],
    )

    const [draftCurrentProjectHours, setDraftCurrentProjectHours] =
        useState<number | null>(null)
    const currentProjectHours =
        draftCurrentProjectHours ?? initialCurrentProject.hours

    const allocated = otherCommittedHours + currentProjectHours
    const remaining = Math.max(TOTAL_WEEKLY_HOURS - allocated, 0)
    const maxForCurrentProject = TOTAL_WEEKLY_HOURS - otherCommittedHours

    if (isLoading) {
        return (
            <div className="flex min-h-40 items-center justify-center">
                <Spinner size="md" />
            </div>
        )
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-8 p-2">
            <div>
                <h2
                    className="text-base font-semibold"
                    style={{ color: 'var(--overlay-foreground)' }}
                >
                    {t('myWorkingHoursSettings.title')}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    {t('myWorkingHoursSettings.description')}
                </p>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 [scrollbar-gutter:auto]">
                <WorkingHoursSummaryCard
                    allocated={allocated}
                    remaining={remaining}
                    total={TOTAL_WEEKLY_HOURS}
                    allocatedLabel={t('myWorkingHoursSettings.summary.allocated')}
                    remainingLabel={t('myWorkingHoursSettings.summary.remaining')}
                />

                <WorkingHoursAllocationCard
                    title={t('myWorkingHoursSettings.currentProjectTitle', {
                        project: project.name,
                    })}
                    subtitle={t('myWorkingHoursSettings.currentProjectSubtitle', {
                        max: maxForCurrentProject,
                        committed: otherCommittedHours,
                    })}
                    hours={currentProjectHours}
                    maxHours={maxForCurrentProject}
                    onChange={setDraftCurrentProjectHours}
                />

                <div className="border-border bg-surface rounded-2xl border p-5">
                    <h3 className="text-base font-semibold">
                        {t('myWorkingHoursSettings.otherProjectsTitle')}
                    </h3>
                    <div className="mt-4 space-y-3">
                        {otherProjects.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between gap-4 text-sm"
                            >
                                <span>{item.name}</span>
                                <span className="text-muted-foreground font-medium">
                                    {item.hours}h
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
