import type {
    ProjectMember,
    ProjectSkill,
} from '../../../../../store/features/project/project.types'
import type {
    Task,
    TaskStatus,
} from '../../../../../store/features/tasks/task.types'

export interface StatusOption {
    id: TaskStatus
    label: string
}

export interface TaskBoardContextValue {
    projectId: string
    members: ProjectMember[]
    skills: ProjectSkill[]
    statusOptions: StatusOption[]
    tasks: Task[]
    isLoading: boolean
}
