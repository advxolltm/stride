import { Button, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { type SyntheticEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateTaskMutation } from '../../../../../store/features/tasks/task.api'
import type { TaskStatus } from '../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../context/useTaskBoard'

export function AddTaskForm({
    columnId,
    onCancel,
}: {
    columnId: TaskStatus
    onCancel: () => void
}) {
    const [title, setTitle] = useState('')
    const { projectId } = useTaskBoard()
    const { t } = useTranslation('space')
    const [createTask, { isLoading: isCreatingTask }] = useCreateTaskMutation()

    async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const trimmed = title.trim()
        if (!trimmed) return

        try {
            await createTask({
                project_id: projectId,
                title: trimmed,
                status: columnId,
                position: null,
                description: null,
                start_date: null,
                due_date: null,
                expected_duration_hours: null,
            }).unwrap()

            toast.success(t('tasks.messages.createSuccess'))
            setTitle('')
            onCancel()
        } catch {
            toast.danger(t('tasks.messages.createError'))
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-3"
        >
            <TextField className="w-full" name={`${columnId}-title`}>
                <Label>{t('tasks.form.title')}</Label>
                <Input
                    autoFocus
                    variant="secondary"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <FieldError />
            </TextField>

            <div className="flex items-center gap-2">
                <Button
                    type="submit"
                    size="sm"
                    isDisabled={
                        !title.trim() || isCreatingTask
                    }
                >
                    {t('tasks.actions.createTask')}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onPress={onCancel}
                >
                    {t('tasks.actions.cancel')}
                </Button>
            </div>
        </form>
    )
}
