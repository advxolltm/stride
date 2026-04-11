import { CheckSquare } from 'lucide-react'
import { ProjectSpaceHeader } from '../components/project'
import { KanbanBoard } from '../components/project/space/kanban/KanbanBoard'
import { useTranslation } from 'react-i18next'

export function TasksPage() {
    const { t } = useTranslation("project")

    return (
        <div className="flex flex-col gap-6 p-6">
            <ProjectSpaceHeader
                title={t('spaces.tasks')}
                description={t('spaces.tasksDescription')}
                projectName="Marketing Campaign Q2"
                icon={CheckSquare}
                iconColor="yellow"
            />
            <KanbanBoard />
        </div>
    )
}
