import { Button, Calendar, Label, Popover, Spinner, toast } from '@heroui/react'
import type { DateValue } from '@internationalized/date'
import { parseDate } from '@internationalized/date'
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdateTaskMutation } from '../../../../../../../store/features/tasks/task.api'
import type {
    Task,
    UpdateTaskRequest,
} from '../../../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../../../context/useTaskBoard'

interface TaskDateFieldProps {
    task: Task
    label: string
    emptyLabel: string
    dateValue: string | null
    minDateValue?: string | null
    maxDateValue?: string | null
    requestFieldName: Extract<keyof UpdateTaskRequest, 'start_date' | 'due_date'>
}

type OptimisticDateUpdate = {
    taskId: string
    requestFieldName: TaskDateFieldProps['requestFieldName']
    dateValue: string | null
}

export function TaskDateField({
    task,
    label,
    emptyLabel,
    dateValue,
    minDateValue,
    maxDateValue,
    requestFieldName,
}: Readonly<TaskDateFieldProps>) {
    const { t, i18n } = useTranslation('space')
    const { projectId } = useTaskBoard()
    const [updateTask, { isLoading: isSaving }] = useUpdateTaskMutation()
    const [isOpen, setIsOpen] = useState(false)
    const [optimisticDateUpdate, setOptimisticDateUpdate] =
        useState<OptimisticDateUpdate | null>(null)

    const optimisticDate =
        optimisticDateUpdate?.taskId === task.id &&
        optimisticDateUpdate.requestFieldName === requestFieldName
            ? optimisticDateUpdate.dateValue
            : dateValue
    const dateOnly = optimisticDate ? optimisticDate.split('T')[0] : null
    const parsedValue = dateOnly ? parseDate(dateOnly) : null
    const minDateOnly = minDateValue ? minDateValue.split('T')[0] : null
    const maxDateOnly = maxDateValue ? maxDateValue.split('T')[0] : null
    const minValue = minDateOnly ? parseDate(minDateOnly) : undefined
    const maxValue = maxDateOnly ? parseDate(maxDateOnly) : undefined
    const formattedLabel = dateOnly
        ? new Date(dateOnly).toLocaleDateString(i18n.language, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
          })
        : emptyLabel

    async function updateTaskDate(nextDate: string | null) {
        setOptimisticDateUpdate({
            taskId: task.id,
            requestFieldName,
            dateValue: nextDate,
        })
        await updateTask({
            taskId: task.id,
            projectId,
            body: { [requestFieldName]: nextDate },
        }).unwrap()
        toast.success(t('tasks.messages.taskUpdateSuccess'))
    }

    async function handleChange(date: DateValue) {
        setIsOpen(false)
        await updateTaskDate(date.toString())
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex w-full items-center justify-between gap-2">
                <Label>{label}</Label>
                {isSaving && <Spinner color="current" size="sm" />}
            </div>
            <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
                <Popover.Trigger>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 font-normal"
                        isDisabled={isSaving}
                    >
                        <CalendarDays
                            size={14}
                            className="text-muted shrink-0"
                        />
                        <span className={dateOnly ? '' : 'text-muted'}>
                            {formattedLabel}
                        </span>
                    </Button>
                </Popover.Trigger>
                <Popover.Content className="p-0">
                    <Calendar
                        aria-label={label}
                        value={parsedValue}
                        minValue={minValue}
                        maxValue={maxValue}
                        onChange={handleChange}
                    >
                        <Calendar.Header>
                            <Calendar.NavButton slot="previous" />
                            <Calendar.Heading />
                            <Calendar.NavButton slot="next" />
                        </Calendar.Header>
                        <Calendar.Grid>
                            <Calendar.GridHeader>
                                {(day) => (
                                    <Calendar.HeaderCell>
                                        {day}
                                    </Calendar.HeaderCell>
                                )}
                            </Calendar.GridHeader>
                            <Calendar.GridBody>
                                {(date) => <Calendar.Cell date={date} />}
                            </Calendar.GridBody>
                        </Calendar.Grid>
                    </Calendar>
                </Popover.Content>
            </Popover>
        </div>
    )
}
