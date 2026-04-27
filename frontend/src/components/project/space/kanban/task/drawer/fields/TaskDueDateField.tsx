import { Button, Calendar, Label, Popover, Spinner } from '@heroui/react'
import type { DateValue } from '@internationalized/date'
import { parseDate } from '@internationalized/date'
import { CalendarDays, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdateTaskMutation } from '../../../../../../../store/features/tasks/task.api'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../../../context/useTaskBoard'

export function TaskDueDateField({ task }: { task: Task }) {
    const { t, i18n } = useTranslation('space')
    const { projectId } = useTaskBoard()
    const [updateTask, { isLoading: isSaving }] = useUpdateTaskMutation()
    const [isOpen, setIsOpen] = useState(false)
    const [optimisticDate, setOptimisticDate] = useState(task.dueDate)

    const dateOnly = optimisticDate ? optimisticDate.split('T')[0] : null
    const parsedValue = dateOnly ? parseDate(dateOnly) : null
    const formattedLabel = dateOnly
        ? new Date(dateOnly).toLocaleDateString(i18n.language, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
          })
        : t('tasks.form.noDueDate')

    async function handleChange(date: DateValue) {
        const next = date.toString()
        setOptimisticDate(next)
        setIsOpen(false)
        await updateTask({
            taskId: task.id,
            projectId,
            body: { due_date: next },
        })
    }

    async function handleClear(e: React.MouseEvent) {
        e.stopPropagation()
        setOptimisticDate(null)
        await updateTask({
            taskId: task.id,
            projectId,
            body: { due_date: null },
        })
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex w-full items-center justify-between gap-2">
                <Label>{t('tasks.form.dueDate')}</Label>
                {isSaving && <Spinner color="current" size="sm" />}
            </div>
            <Popover  isOpen={isOpen} onOpenChange={setIsOpen}>
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
                        {dateOnly && (
                            <span className="ml-auto" onClick={handleClear}>
                                <X
                                    size={13}
                                    className="text-muted hover:text-foreground"
                                />
                            </span>
                        )}
                    </Button>
                </Popover.Trigger>
                <Popover.Content className="p-0">
                    <Calendar
                        aria-label={t('tasks.form.dueDate')}
                        value={parsedValue}
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
