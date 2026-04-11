export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Task {
    id: string
    project_id: string
    created_by: string
    title: string
    description?: string
    status: TaskStatus
    start_date?: string
    due_date?: string
    expected_duration_minutes?: number
    position: number
    created_at: string
    updated_at: string
    completed_at?: string
    assignee: Assignee
    labels?: string[]
    priority?: 'low' | 'medium' | 'high'
}

export interface Assignee {
    id: string
    initials: string
    color?: string
}

export interface Column {
    id: TaskStatus
    label: string
    dotColor: string
    tasks: Task[]
}