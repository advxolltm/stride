export type OptionalColumnId =
    | 'description'
    | 'skills'
    | 'assignee'
    | 'status'
    | 'startDate'
    | 'dueDate'

export type ListColumnId = 'task' | OptionalColumnId

export type ColumnWidthMap = Record<ListColumnId, number>

export const TASK_LIST_COLUMN_ORDER: OptionalColumnId[] = [
    'description',
    'skills',
    'assignee',
    'status',
    'startDate',
    'dueDate',
]

export const DEFAULT_TASK_LIST_COLUMN_WIDTHS: ColumnWidthMap = {
    task: 320,
    description: 240,
    skills: 180,
    assignee: 180,
    status: 140,
    startDate: 140,
    dueDate: 140,
}

export const TASK_LIST_COLUMN_MIN_WIDTHS: Record<ListColumnId, number> = {
    task: 260,
    description: 180,
    skills: 150,
    assignee: 150,
    status: 120,
    startDate: 120,
    dueDate: 120,
}

export const TASK_LIST_COLUMN_MAX_WIDTHS: Record<ListColumnId, number> = {
    task: 720,
    description: 420,
    skills: 360,
    assignee: 320,
    status: 240,
    startDate: 220,
    dueDate: 220,
}
