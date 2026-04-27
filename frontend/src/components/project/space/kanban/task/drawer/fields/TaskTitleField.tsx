import { FieldError, Input, Label, Spinner, TextField } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdateTaskMutation } from '../../../../../../../store/features/tasks/task.api'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../../../context/useTaskBoard'

export function TaskTitleField({ task }: { task: Task }) {
    const { t } = useTranslation('space')
    const { projectId } = useTaskBoard()
    const [updateTask, { isLoading: isSaving }] = useUpdateTaskMutation()
    const [titleError, setTitleError] = useState('')
    const [value, setValue] = useState(task.title)

    async function handleBlur(value: string) {
        const trimmed = value.trim()

        // If empty → revert to original title
        if (trimmed.length === 0) {
            setValue(task.title)
            setTitleError('')
            return
        }

        // If unchanged → do nothing
        if (trimmed === task.title) return

        await updateTask({
            taskId: task.id,
            projectId,
            body: { title: trimmed },
        })
    }

    return (
        <TextField
            className="w-full"
            value={value}
            onChange={(nextValue) => {
                setValue(nextValue)
                if (nextValue.trim().length === 0) {
                    setTitleError(t('tasks.form.titleRequired'))
                } else {
                    setTitleError('')
                }
            }}
            isInvalid={!!titleError}
        >
            <div className="flex w-full items-center justify-between gap-2">
                <Label>{t('tasks.form.title')}</Label>
                {isSaving && <Spinner color="current" size="sm" />}
            </div>
            <Input
                variant="secondary"
                disabled={isSaving}
                onBlur={() => handleBlur(value)}
            />
            <FieldError>{titleError}</FieldError>
        </TextField>
    )
}
