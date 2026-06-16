import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useGetTaskQuery } from '../../../../store/features/tasks/task.api'
import { useNavigate } from 'react-router-dom'

interface ViewTaskButtonProps {
    taskId: string
}

export function ViewTaskButton({
    taskId,
}: ViewTaskButtonProps) {
    const { t } = useTranslation('project')
	const { data: task } = useGetTaskQuery(taskId);

	const navigate = useNavigate();
	function handleViewTask() {
		navigate(`/project/${task?.projectId}/tasks?taskID=${task?.id}`)	
	}

    return (
        <Button
            size="sm"
            variant="ghost"
            className="h-10 min-w-10 gap-0 -space-x-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-2 text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
			onPress={handleViewTask}
        >
            {t("whiteboardPage.region.viewTask")}
        </Button>

    )
}
