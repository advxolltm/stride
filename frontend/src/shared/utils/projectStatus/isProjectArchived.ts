import type { Project } from '../../../store/features/project/project.types'

type ProjectStatusSource = Pick<Project, 'status'> | null | undefined

export function isProjectArchived(project: ProjectStatusSource): boolean {
    return project?.status === 'archived'
}
