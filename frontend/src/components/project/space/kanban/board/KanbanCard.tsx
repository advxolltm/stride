import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Card, Dropdown, Label, Tooltip } from '@heroui/react'
import { Calendar, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../../../../../store/features/tasks/task.types'
import { UserAvatar } from '../../../../../shared/components'
import { TaskSkillChips } from './TaskSkillChips'

interface KanbanCardProps {
    task: Task
    onClick?: (task: Task) => void
    onEdit?: (task: Task) => void
    onDelete?: (task: Task) => void
    readOnly?: boolean
}

export function KanbanCard({
    task,
    onClick,
    onEdit,
    onDelete,
    readOnly = false,
}: KanbanCardProps) {
    const { t, i18n } = useTranslation('space')

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, disabled: readOnly })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const formatCardDate = (date: string) =>
        new Date(date).toLocaleDateString(i18n.language, {
            month: 'short',
            day: 'numeric',
        })

    const formattedStartDate = task.startDate
        ? formatCardDate(task.startDate)
        : null
    const formattedDueDate = task.dueDate ? formatCardDate(task.dueDate) : null
    const formattedDateRange =
        formattedStartDate && formattedDueDate
            ? `${formattedStartDate} - ${formattedDueDate}`
            : formattedStartDate || formattedDueDate
    const assignee = task.assignees?.[0]
    const assigneeName = assignee
        ? (assignee.user.fullName ?? assignee.user.username)
        : ''
    const sortableProps = readOnly ? {} : { ...attributes, ...listeners }

    function handleEdit() {
        if (onEdit) {
            onEdit(task)
            return
        }
        onClick?.(task)
    }

    function handleDelete() {
        onDelete?.(task)
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...sortableProps}
            onClick={() => onClick?.(task)}
            className={`shrink-0 ${
                readOnly
                    ? 'cursor-default'
                    : 'cursor-grab active:cursor-grabbing'
            } ${isDragging ? 'opacity-40' : ''}`}
        >
            <Card
                variant="default"
                className="rounded-lg p-4 transition-shadow hover:shadow-md"
            >
                <Card.Content className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-default-900 truncate text-sm font-medium">
                            {task.title}
                        </p>

                        {!readOnly && (
                            <Dropdown>
                                <Button
                                    aria-label={t('tasks.actions.menuAria')}
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 min-w-0 rounded-md p-0 shrink-0"
                                    onPointerDown={(event) =>
                                        event.stopPropagation()
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <MoreHorizontal size={14} />
                                </Button>

                                <Dropdown.Popover>
                                    <Dropdown.Menu
                                        aria-label={t('tasks.actions.menuAria')}
                                        onAction={(key) => {
                                            if (key === 'edit') {
                                                handleEdit()
                                            }
                                            if (key === 'delete') {
                                                handleDelete()
                                            }
                                        }}
                                    >
                                        <Dropdown.Item
                                            id="edit"
                                            textValue={t('tasks.actions.edit')}
                                        >
                                            <Label>
                                                {t('tasks.actions.edit')}
                                            </Label>
                                        </Dropdown.Item>

                                        <Dropdown.Item
                                            id="delete"
                                            textValue={t(
                                                'tasks.actions.delete',
                                            )}
                                            variant="danger"
                                        >
                                            <Label>
                                                {t('tasks.actions.delete')}
                                            </Label>
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        )}
                    </div>

                    <TaskSkillChips skills={task.skills} />

                    <div className="flex items-center justify-between">
                        <div className="text-default-400 flex items-center gap-1">
                            {formattedDateRange && (
                                <>
                                    <Calendar size={13} />
                                    <span className="text-xs">
                                        {formattedDateRange}
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            {assignee && (
                                <Tooltip delay={0}>
                                    <Tooltip.Trigger>
                                        <UserAvatar
                                            className="h-7 w-7 text-sm"
                                            name={assigneeName}
                                            src={
                                                assignee.user.avatarSmallUrl ??
                                                assignee.user.avatarUrl
                                            }
                                        />
                                    </Tooltip.Trigger>
                                    <Tooltip.Content
                                        showArrow
                                        placement="bottom"
                                    >
                                        <Tooltip.Arrow />
                                        {assigneeName}
                                    </Tooltip.Content>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </Card.Content>
            </Card>
        </div>
    )
}
