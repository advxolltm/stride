import { Button, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { CalendarDays, CheckCircle2, Circle, Clock3, Inbox } from 'lucide-react'
import { type SyntheticEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '../../../../../shared/components'
import { useCreateTaskMutation } from '../../../../../store/features/tasks/task.api'
import type {
    Column,
    Task,
    TaskStatus,
} from '../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../context/useTaskBoard'
import { TaskSkillChips } from './TaskSkillChips'

const statusIcons = {
    todo: Circle,
    in_progress: Clock3,
    done: CheckCircle2,
} as const

interface TaskCardListProps {
    tasks: Task[]
    columns: Column[]
    statusLabelMap: Map<TaskStatus, string>
    onTaskClick: (task: Task) => void
    isAddingTask: boolean
    onAddingTaskChange: (open: boolean) => void
}

function TaskCard({
    task,
    columns,
    statusLabelMap,
    onTaskClick,
}: {
    task: Task
    columns: Column[]
    statusLabelMap: Map<TaskStatus, string>
    onTaskClick: (task: Task) => void
}) {
    const { t } = useTranslation('space')
    const StatusIcon = statusIcons[task.status]
    const statusColor =
        columns.find((col) => col.id === task.status)?.dotColor ?? '#71717a'
    const assignee = task.assignees?.[0]
    const assigneeName =
        assignee?.user.fullName ??
        assignee?.user.username ??
        t('tasks.form.assigneeEmpty')

    const formattedStartDate = task.startDate
        ? new Date(task.startDate).toLocaleDateString()
        : null
    const formattedDueDate = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString()
        : null

    return (
        <button
            type="button"
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-colors hover:bg-[var(--surface-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]/40"
            onClick={() => onTaskClick(task)}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <StatusIcon
                            size={16}
                            style={{ color: statusColor }}
                            className="shrink-0"
                        />
                        <span className="text-foreground truncate text-sm font-medium">
                            {task.title}
                        </span>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                        {statusLabelMap.get(task.status) ?? task.status}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        {assignee ? (
                            <>
                                <UserAvatar
                                    className="h-6 w-6 text-xs"
                                    name={assigneeName}
                                    src={
                                        assignee.user.avatarSmallUrl ??
                                        assignee.user.avatarUrl
                                    }
                                />
                                <span className="text-muted-foreground truncate text-xs">
                                    {assigneeName}
                                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground text-xs">
                                {t('tasks.form.assigneeEmpty')}
                            </span>
                        )}
                    </div>
                    {task.expectedDurationHours != null && (
                        <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                            <Clock3 size={12} />
                            <span>
                                {t('tasks.list.estimatedTimeValue', {
                                    count: task.expectedDurationHours,
                                })}
                            </span>
                        </div>
                    )}
                </div>

                {task.description && (
                    <div className="border-t border-[var(--border)] pt-3">
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                            {task.description}
                        </p>
                    </div>
                )}

                {(task.skills ?? []).length > 0 && (
                    <div>
                        <TaskSkillChips skills={task.skills} />
                    </div>
                )}

                {(formattedStartDate || formattedDueDate) && (
                    <div className="border-t border-[var(--border)] flex flex-wrap items-center gap-4 pt-3">
                        {formattedStartDate && (
                            <div className="text-muted-foreground flex items-center gap-1 text-xs">
                                <CalendarDays size={12} />
                                <span>{formattedStartDate}</span>
                            </div>
                        )}
                        {formattedDueDate && (
                            <div className="text-muted-foreground flex items-center gap-1 text-xs">
                                <CalendarDays size={12} />
                                <span>{formattedDueDate}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </button>
    )
}

export function TaskCardList({
    tasks,
    columns,
    statusLabelMap,
    onTaskClick,
    isAddingTask,
    onAddingTaskChange,
}: Readonly<TaskCardListProps>) {
    const { t } = useTranslation('space')
    const { projectId } = useTaskBoard()
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [createTask, { isLoading: isCreatingTask }] = useCreateTaskMutation()

    async function handleCreateTask(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const trimmed = newTaskTitle.trim()
        if (!trimmed) return

        try {
            await createTask({
                project_id: projectId,
                title: trimmed,
                status: 'todo' satisfies TaskStatus,
                position: null,
                description: null,
                start_date: null,
                due_date: null,
                expected_duration_hours: null,
            }).unwrap()

            toast.success(t('tasks.messages.createSuccess'))
            setNewTaskTitle('')
            onAddingTaskChange(false)
        } catch {
            toast.danger(t('tasks.messages.createError'))
        }
    }

    if (tasks.length === 0 && !isAddingTask) {
        return (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                    <Inbox size={22} />
                </div>
                <div className="space-y-1">
                    <p className="text-foreground text-sm font-semibold">
                        {t('tasks.list.emptyTitle')}
                    </p>
                    <p className="text-muted-foreground text-sm">
                        {t('tasks.list.emptyDescription')}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            {isAddingTask && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                    <form
                        onSubmit={handleCreateTask}
                        className="flex flex-col gap-4"
                    >
                        <TextField className="w-full" name="task-list-title">
                            <Label>{t('tasks.form.title')}</Label>
                            <Input
                                autoFocus
                                variant="secondary"
                                value={newTaskTitle}
                                placeholder={t('tasks.form.titlePlaceholder')}
                                onChange={(event) =>
                                    setNewTaskTitle(event.target.value)
                                }
                            />
                            <FieldError />
                        </TextField>

                        <div className="flex items-center justify-between gap-2">
                            <Button
                                type="submit"
                                size="sm"
                                isDisabled={
                                    !newTaskTitle.trim() || isCreatingTask
                                }
                            >
                                {t('tasks.actions.createTask')}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onPress={() => {
                                    setNewTaskTitle('')
                                    onAddingTaskChange(false)
                                }}
                            >
                                {t('tasks.actions.cancel')}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {tasks.map((task) => (
                <TaskCard
                    key={task.id}
                    task={task}
                    columns={columns}
                    statusLabelMap={statusLabelMap}
                    onTaskClick={onTaskClick}
                />
            ))}
        </div>
    )
}
