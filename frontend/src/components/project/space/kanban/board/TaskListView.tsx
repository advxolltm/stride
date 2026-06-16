import {
    Button,
    FieldError,
    Input,
    Label,
    TextField,
    toast,
} from '@heroui/react'
import {
    CalendarDays,
    CheckCircle2,
    Circle,
    Clock3,
    Inbox,
} from 'lucide-react'
import {
    type MouseEvent as ReactMouseEvent,
    type SyntheticEvent,
    useMemo,
    useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '../../../../../shared/components'
import { useCreateTaskMutation } from '../../../../../store/features/tasks/task.api'
import type {
    Column,
    Task,
    TaskStatus,
} from '../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../context/useTaskBoard'
import type {
    ColumnWidthMap,
    ListColumnId,
    OptionalColumnId,
} from './taskList.config'
import { TASK_LIST_COLUMN_ORDER } from './taskList.config'
import { TaskSkillChips } from './TaskSkillChips'

interface TaskListViewProps {
    columns: Column[]
    onTaskClick: (task: Task) => void
    visibleColumns: OptionalColumnId[]
    columnWidths: ColumnWidthMap
    onResizeStart: (
        columnId: ListColumnId,
        event: ReactMouseEvent<HTMLButtonElement>,
    ) => void
    isAddingTask: boolean
    onAddingTaskChange: (open: boolean) => void
}

const statusIcons = {
    todo: Circle,
    in_progress: Clock3,
    done: CheckCircle2,
} as const

export function TaskListView({
    columns,
    onTaskClick,
    visibleColumns,
    columnWidths,
    onResizeStart,
    isAddingTask,
    onAddingTaskChange,
}: Readonly<TaskListViewProps>) {
    const { t } = useTranslation('space')
    const { projectId, statusOptions } = useTaskBoard()
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [createTask, { isLoading: isCreatingTask }] = useCreateTaskMutation()

    const tasks = useMemo(
        () => columns.flatMap((column) => column.tasks),
        [columns],
    )

    const statusLabelMap = useMemo(
        () =>
            new Map(
                statusOptions.map((option) => [option.id, option.label] as const),
            ),
        [statusOptions],
    )

    const activeColumns = useMemo(
        () =>
            TASK_LIST_COLUMN_ORDER.filter((columnId) =>
                visibleColumns.includes(columnId),
            ),
        [visibleColumns],
    )

    async function handleCreateTask(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const trimmed = newTaskTitle.trim()
        if (!trimmed) return

        try {
            await createTask({
                project_id: projectId,
                title: trimmed,
                status: 'todo' satisfies TaskStatus,
                position: 0,
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

    function getGridTemplateColumns() {
        const optionalParts = activeColumns.map(
            (columnId) => `${columnWidths[columnId]}px`,
        )

        return [`${columnWidths.task}px`, ...optionalParts].join(' ')
    }

    const tableWidth = useMemo(
        () =>
            columnWidths.task +
            activeColumns.reduce(
                (total, columnId) => total + columnWidths[columnId],
                0,
            ),
        [activeColumns, columnWidths],
    )
    const lastResizableColumnId: ListColumnId | null =
        activeColumns.length > 0
            ? activeColumns[activeColumns.length - 1]
            : 'task'

    function renderCell(task: Task, columnId: OptionalColumnId) {
        const assignee = task.assignees?.[0]
        const assigneeName =
            assignee?.user.fullName ??
            assignee?.user.username ??
            t('tasks.form.assigneeEmpty')

        switch (columnId) {
            case 'description':
                return task.description ? (
                    <div className="w-full min-w-0 max-w-full overflow-hidden">
                        <span
                            className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm"
                            title={task.description}
                        >
                            {task.description}
                        </span>
                    </div>
                ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                )

            case 'skills':
                return (task.skills ?? []).length > 0 ? (
                    <TaskSkillChips skills={task.skills} />
                ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                )

            case 'assignee':
                return assignee ? (
                    <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar
                            className="h-7 w-7 text-xs"
                            name={assigneeName}
                            src={
                                assignee.user.avatarSmallUrl ??
                                assignee.user.avatarUrl
                            }
                        />
                        <span className="truncate text-sm">{assigneeName}</span>
                    </div>
                ) : (
                    <span className="text-muted-foreground text-sm">
                        {t('tasks.form.assigneeEmpty')}
                    </span>
                )

            case 'status': {
                const Icon = statusIcons[task.status]
                return (
                    <div className="flex items-center gap-2">
                        <Icon
                            size={14}
                            style={{
                                color:
                                    columns.find(
                                        (column) => column.id === task.status,
                                    )?.dotColor ?? '#71717a',
                            }}
                        />
                        <span className="truncate text-sm">
                            {statusLabelMap.get(task.status) ?? task.status}
                        </span>
                    </div>
                )
            }

            case 'startDate':
                return (
                    <div className="flex items-center gap-2 text-sm">
                        <CalendarDays
                            size={14}
                            className="text-muted-foreground shrink-0"
                        />
                        <span className="truncate">
                            {task.startDate
                                ? new Date(task.startDate).toLocaleDateString()
                                : t('tasks.form.noStartDate')}
                        </span>
                    </div>
                )

            case 'dueDate':
                return (
                    <div className="flex items-center gap-2 text-sm">
                        <CalendarDays
                            size={14}
                            className="text-muted-foreground shrink-0"
                        />
                        <span className="truncate">
                            {task.dueDate
                                ? new Date(task.dueDate).toLocaleDateString()
                                : t('tasks.form.noDueDate')}
                        </span>
                    </div>
                )
        }
    }

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
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

            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="h-full overflow-auto">
                    <div
                        className="min-h-full"
                        style={{ minWidth: `${tableWidth}px` }}
                    >
                        <div
                            className="text-muted-foreground sticky top-0 z-20 grid items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-sm font-medium before:absolute before:inset-0 before:bg-[var(--surface)] before:content-['']"
                            style={{
                                gridTemplateColumns: getGridTemplateColumns(),
                            }}
                        >
                            <div className="group hover:text-foreground relative z-10 flex min-w-0 items-center gap-2 pr-3 transition-colors">
                                <span className="truncate">
                                    {t('tasks.list.columns.task')}
                                </span>
                                {lastResizableColumnId !== 'task' && (
                                    <button
                                        type="button"
                                        aria-label={t('tasks.list.resizeColumn', {
                                            column: t('tasks.list.columns.task'),
                                        })}
                                        className="absolute top-1/2 right-0 h-8 w-3 -translate-y-1/2 cursor-col-resize"
                                        onMouseDown={(event) =>
                                            onResizeStart('task', event)
                                        }
                                    >
                                        <span className="absolute top-1/2 right-1 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--border)] opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100" />
                                    </button>
                                )}
                            </div>
                            {activeColumns.map((columnId) => (
                                <div
                                    key={columnId}
                                    className="group hover:text-foreground relative z-10 flex min-w-0 items-center gap-2 pr-3 transition-colors"
                                >
                                    <span className="truncate">
                                        {t(`tasks.list.columns.${columnId}`)}
                                    </span>
                                    {lastResizableColumnId !== columnId && (
                                        <button
                                            type="button"
                                            aria-label={t('tasks.list.resizeColumn', {
                                                column: t(
                                                    `tasks.list.columns.${columnId}`,
                                                ),
                                            })}
                                            className="absolute top-1/2 right-0 h-8 w-3 -translate-y-1/2 cursor-col-resize"
                                            onMouseDown={(event) =>
                                                onResizeStart(columnId, event)
                                            }
                                        >
                                            <span className="absolute top-1/2 right-1 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--border)] opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="divide-y divide-[var(--border)]">
                            {tasks.length === 0 ? (
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
                            ) : (
                                tasks.map((task) => {
                                    return (
                                        <button
                                            key={task.id}
                                            type="button"
                                            className="group relative grid w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-[var(--surface-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]/40"
                                            style={{
                                                gridTemplateColumns:
                                                    getGridTemplateColumns(),
                                            }}
                                            onClick={() => onTaskClick(task)}
                                        >
                                            <div className="min-w-0">
                                                <span className="text-foreground block truncate text-sm font-medium">
                                                    {task.title}
                                                </span>
                                            </div>

                                            {activeColumns.map((columnId) => (
                                                <div
                                                    key={columnId}
                                                    className={
                                                        columnId ===
                                                        'description'
                                                            ? 'w-full min-w-0 max-w-full overflow-hidden'
                                                            : 'w-full min-w-0 overflow-hidden'
                                                    }
                                                >
                                                    {renderCell(task, columnId)}
                                                </div>
                                            ))}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
