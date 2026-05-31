import type { TaskStatus } from '../../../../../store/features/tasks/task.types'

export interface SchedulerTriggerRequest {
    task_ids: string[]
    user_ids: string[]
}

export interface SchedulerAssignment {
    user_id: string
    task_id: string
}

export type SchedulerConfirmRequest = SchedulerAssignment[]

export interface SchedulerMemberOption {
    id: string
    name: string
    initials: string
    color?: string
    avatarUrl?: string | null
    working_hours: number
}

export interface SchedulerTaskOption {
    id: string
    title: string
    status: TaskStatus
    status_label: string
}
