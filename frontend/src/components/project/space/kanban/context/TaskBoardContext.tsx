import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useGetProjectByIdQuery } from '../../../../../store/features/project/project.api'
import { useGetTasksForProjectQuery } from '../../../../../store/features/tasks/task.api'
import type { TaskBoardContextValue } from './taskBoard.types'
import { TaskBoardContext } from './taskBoardContext.shared'

// Provides task board-related data (project, tasks, etc.) to its children via React Context
export function TaskBoardProvider({ children }: { children: React.ReactNode }) {
    // Extract projectId from the current route params
    const { projectId } = useParams()

    // Translation function scoped to the "space" namespace
    const { t } = useTranslation('space')

    // Fetch tasks for the given project
    const { data: tasks = [], isLoading } = useGetTasksForProjectQuery(
        projectId!,
    )
    // Fetch project in order to access its details (members, skills, etc.)
    const { data: project } = useGetProjectByIdQuery(projectId!)

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo<TaskBoardContextValue>(
        () => ({
            projectId: project?.id ?? '',
            members: project?.members ?? [], // Provide project members, fallback to empty array if not loaded yet
            skills: project?.skills ?? [], // Provide project skills, fallback to empty array
            statusOptions: [
                { id: 'todo', label: t('tasks.columns.todo') },
                { id: 'in_progress', label: t('tasks.columns.inProgress') },
                { id: 'done', label: t('tasks.columns.done') },
            ], // Static task status columns with translated labels
            tasks, // List of tasks for the board
            isLoading, // Loading state for tasks fetching
        }),
        [project, tasks, isLoading, t],
    )

    // Provide the computed value to all children components
    return (
        <TaskBoardContext.Provider value={value}>
            {children}
        </TaskBoardContext.Provider>
    )
}
