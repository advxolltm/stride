import type { TaskStatus } from '../../../../../store/features/tasks/task.types'
import type { SchedulerAssignment } from '../../../../../store/features/project/project.types'

export interface SchedulerMemberOption {
    id: string
    name: string
    initials: string
    color?: string
    avatarUrl?: string | null
    workingHours: number
}

export interface SchedulerTaskOption {
    id: string
    title: string
    status: TaskStatus
    statusLabel: string
    startDate: string | null
    expectedDurationHours: number | null
}

export type { SchedulerAssignment }
