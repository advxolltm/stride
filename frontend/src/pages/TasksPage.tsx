import { CheckSquare } from 'lucide-react'
import { KanbanBoard } from '../components/project/space/kanban/board/KanbanBoard'
import { useTranslation } from 'react-i18next'
import { ProjectSpaceHeader } from '../components/project/space/ProjectSpaceHeader'
import { TaskBoardProvider } from '../components/project/space/kanban/context/TaskBoardContext'

export function TasksPage() {
    const { t } = useTranslation('project')

    return (
        <div className="flex flex-col gap-6">
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
    )
}
