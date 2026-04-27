import { useTranslation } from 'react-i18next'
import { useUpdateTaskMutation } from '../../../../../../../store/features/tasks/task.api'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../../../context/useTaskBoard'
import { TaskTextField } from './TaskTextField'

export function TaskDescriptionField({ task }: { task: Task }) {
    const { t } = useTranslation('space')
    const { projectId } = useTaskBoard()
    const [updateTask, { isLoading: isSaving }] = useUpdateTaskMutation()

    async function handleBlur(value: string) {
        const trimmed = value.trim() || null
        if (trimmed === task.description) return
        await updateTask({ taskId: task.id, projectId, body: { description: trimmed } })
    }

    return (
        <TaskTextField
            label={t('tasks.form.description')}
            defaultValue={task.description ?? ''}
            onBlur={handleBlur}
            multiline
            isSaving={isSaving}
        />
    )
}