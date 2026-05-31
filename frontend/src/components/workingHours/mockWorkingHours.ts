import getInitials from '../../shared/utils/getInitials'
import type { Project } from '../../store/features/project/project.types'
import type { WorkingHoursAllocation } from './types'

export const TOTAL_WEEKLY_HOURS = 40

const WORKING_HOURS_COLORS = ['#4f46e5', '#4338ca', '#6366f1', '#3730a3']

export function buildMockWorkingHoursAllocations(
    projects: Project[],
): WorkingHoursAllocation[] {
    if (projects.length === 0) {
        return []
    }

    if (projects.length === 1) {
        const project = projects[0]

        return [
            {
                id: project.id,
                name: project.name,
                initials: getInitials(project.name),
                hours: TOTAL_WEEKLY_HOURS,
                color: WORKING_HOURS_COLORS[0],
            },
        ]
    }

    const baseHours = Math.floor(TOTAL_WEEKLY_HOURS / projects.length)
    let remainder = TOTAL_WEEKLY_HOURS - baseHours * projects.length

    return projects.map((project, index) => {
        const extraHour = remainder > 0 ? 1 : 0
        remainder = Math.max(0, remainder - 1)

        return {
            id: project.id,
            name: project.name,
            initials: getInitials(project.name),
            hours: baseHours + extraHour,
            color: WORKING_HOURS_COLORS[index % WORKING_HOURS_COLORS.length],
        }
    })
}
