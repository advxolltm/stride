import { CheckSquare } from 'lucide-react'
import { KanbanBoard } from '../components/project/space/kanban/board/KanbanBoard'
import { useTranslation } from 'react-i18next'
import { ProjectSpaceHeader } from '../components/project/space/ProjectSpaceHeader'
import { TaskBoardProvider } from '../components/project/space/kanban/context/TaskBoardContext'
import { ProjectChatPanel } from '../components/project/space/chat/ProjectChatPanel'
import { useParams } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import { useWatchProjectTasksSocketQuery } from '../store/features/tasks/task.socket'

export function TasksPage() {
    const { t } = useTranslation('project')
    const { projectId } = useParams()
    useWatchProjectTasksSocketQuery(projectId ?? skipToken)

    return (
        <div className="flex min-h-[calc(100dvh-7rem)] min-h-0">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
                <ProjectSpaceHeader
                    title={t('spaces.tasks')}
                    description={t('spaces.tasksDescription')}
                    icon={CheckSquare}
                    iconColor="yellow"
                />
                <TaskBoardProvider>
                    <KanbanBoard />
                </TaskBoardProvider>
            </div>
            {projectId ? <ProjectChatPanel projectId={projectId} /> : null}
        </div>
    )
}
