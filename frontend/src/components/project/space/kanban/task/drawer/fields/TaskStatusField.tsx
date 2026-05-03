import { Label, ListBox, Select, Spinner, toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useTaskBoard } from '../../../context/useTaskBoard'
import { useUpdateTaskMutation } from '../../../../../../../store/features/tasks/task.api'
import type {
    Task,
    TaskStatus,
} from '../../../../../../../store/features/tasks/task.types'

export function TaskStatusField({ task }: { task: Task }) {
    const { t } = useTranslation('space')
    const { projectId, statusOptions } = useTaskBoard()
    const [updateTask, { isLoading: isSaving }] = useUpdateTaskMutation()

    const label = statusOptions.find((o) => o.id === task.status)?.label ?? ''

    async function handleChange(status: TaskStatus) {
        if (status === task.status) return
        await updateTask({
            taskId: task.id,
            projectId,
            body: { status },
        }).unwrap()
        toast.success(t('tasks.messages.taskUpdateSuccess'))
    }

    return (
        <Select
            variant="secondary"
            aria-label={t('tasks.form.status')}
            value={task.status}
            onChange={(key) => handleChange(key as TaskStatus)}
            isDisabled={isSaving}
        >
            <div className="flex w-full items-center justify-between gap-2">
                <Label>{t('tasks.form.status')}</Label>
                {isSaving && <Spinner color="current" size="sm" />}
            </div>
            <Select.Trigger>
                <Select.Value>{label}</Select.Value>
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox items={statusOptions}>
                    {(item) => (
                        <ListBox.Item id={item.id} textValue={item.label}>
                            {item.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    )}
                </ListBox>
            </Select.Popover>
        </Select>
    )
}
