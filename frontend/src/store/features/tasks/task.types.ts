export type ApiTaskAssignee = {
    id: string
    task_id: string
    project_member_id: string
    assigned_at: string
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
    assignees?: ApiTaskAssignee[]
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type TaskAssignee = {
    id: string
    taskId: string
    projectMemberId: string
    assignedAt: string
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
    assignees: TaskAssignee[]
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
