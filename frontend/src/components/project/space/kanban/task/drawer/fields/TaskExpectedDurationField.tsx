import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useUpdateTaskMutation } from '../../../../../../../store/features/tasks/task.api'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../../../context/useTaskBoard'
import {
    formatExpectedDurationHoursInput,
    parseExpectedDurationHoursInput,
    sanitizeExpectedDurationHoursInput,
} from '../../expectedDuration'
import { TaskTextField } from './TaskTextField'

export function TaskExpectedDurationField({ task }: Readonly<{ task: Task }>) {
    const { t } = useTranslation('space')
    const { projectId, isArchived } = useTaskBoard()
    const [updateTask, { isLoading: isSaving }] = useUpdateTaskMutation()

    async function handleSave(value: string) {
        const nextValue = parseExpectedDurationHoursInput(value)
        if (nextValue === task.expectedDurationHours) return

        await updateTask({
            taskId: task.id,
            projectId,
            body: { expected_duration_hours: nextValue },
        }).unwrap()
        toast.success(t('tasks.messages.taskUpdateSuccess'))
    }

    return (
        <TaskTextField
            label={t('tasks.form.expectedDuration')}
            value={formatExpectedDurationHoursInput(task.expectedDurationHours)}
            onSave={handleSave}
            inputType="number"
            min={0}
            step={1}
            inputMode="numeric"
            normalizeValue={sanitizeExpectedDurationHoursInput}
            isSaving={isSaving}
            readOnly={isArchived}
        />
    )
}
