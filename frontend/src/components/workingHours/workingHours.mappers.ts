import getInitials from '../../shared/utils/getInitials'
import type { Project } from '../../store/features/project/project.types'
import type { WorkingHoursAllocation } from './types'

const env = import.meta.env as Record<string, string | undefined>

const readEnv = (key: string, viteKey = `VITE_${key}`) =>
    env[key] ?? env[viteKey]

const parsePositiveInt = (value: unknown, fallback: number) => {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const TOTAL_WEEKLY_HOURS = parsePositiveInt(readEnv('SCHED_WORK_HOURS_PER_DAY'), 8) * 5;

const WORKING_HOURS_COLORS = ['#4f46e5', '#4338ca', '#6366f1', '#3730a3']

export function buildWorkingHoursAllocations(
    projects: Project[],
    userId: string,
): WorkingHoursAllocation[] {
    return projects
        .map((project, index) => {
            const member = project.members.find((item) => item.userId === userId)
            if (!member) {
                return null
            }

            return {
                id: project.id,
                name: project.name,
                initials: getInitials(project.name),
                hours: member.workingHours,
                color: WORKING_HOURS_COLORS[index % WORKING_HOURS_COLORS.length],
            }
        })
        .filter((allocation): allocation is WorkingHoursAllocation =>
            allocation !== null,
        )
}
