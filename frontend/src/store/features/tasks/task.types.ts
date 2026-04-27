import type { User } from '../../../shared/types'

// --- Api types ---

export type ApiTaskAssignee = {
    id: string
    task_id: string
    project_member_id: string
    assigned_at: string
    project_member: {
        id: string
        user_id: string
        project_id: string
        role: string
        joined_at: string
        user: {
            id: string
            username: string
            email: string
            full_name: string | null
            avatar_url: {
                '300': string
                '600': string
                original: string
            } | null
        }
    }
}

export type ApiProjectSkill = {
    id: string
    project_id: string
    name: string
    description: string | null
}

export type ApiTaskSkill = {
    id: string
    task_id: string
    project_skill_id: string
    project_skill: ApiProjectSkill
}

export type ApiTask = {
    id: string
    project_id: string
    created_by: string
    title: string
    description: string | null
    status: string
    start_date: string | null
    due_date: string | null
    expected_duration_minutes: number | null
    position: number
    created_at: string
    updated_at: string
    completed_at: string | null
    task_assignees: ApiTaskAssignee[]
    task_skills: ApiTaskSkill[]
}

// --- Domain types ---

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type TaskAssignee = {
    id: string
    taskId: string
    projectMemberId: string
    assignedAt: string
    user: User
}

export type TaskSkill = {
    id: string
    taskId: string
    projectSkillId: string
    name: string
    description: string | null
}

export type Task = {
    id: string
    projectId: string
    createdBy: string
    title: string
    description: string | null
    status: TaskStatus
    startDate: string | null
    dueDate: string | null
    expectedDurationMinutes: number | null
    position: number
    createdAt: string
    updatedAt: string
    completedAt: string | null
    assignees?: TaskAssignee[]
    skills?: TaskSkill[]
}

export type Column = {
    id: TaskStatus
    label: string
    dotColor: string
    tasks: Task[]
}

export type CreateTaskRequest = {
    project_id: string
    title: string
    description?: string | null
    status: TaskStatus
    start_date?: string | null
    due_date?: string | null
    expected_duration_minutes?: number | null
    position?: number | null
}

export type UpdateTaskRequest = {
    title?: string | null
    description?: string | null
    status?: TaskStatus | null
    start_date?: string | null
    due_date?: string | null
    expected_duration_minutes?: number | null
    skill_ids?: string[]
}

export type AssignTaskRequest = {
    project_member_id: string
}

export type UnassignTaskRequest = {
    project_member_id: string
}

export type MoveTaskRequest = {
    position: number
}
