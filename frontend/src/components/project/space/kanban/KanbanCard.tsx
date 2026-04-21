import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Avatar, Button, Card, Chip, Dropdown, Label } from '@heroui/react'
import { Calendar, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Task } from './types'

interface KanbanCardProps {
    task: Task
    onClick?: (task: Task) => void
    onEdit?: (task: Task) => void
    onDelete?: (task: Task) => void
}

export function KanbanCard({
    task,
    onClick,
    onEdit,
    onDelete,
}: KanbanCardProps) {
    const { t, i18n } = useTranslation('space')

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const formattedDate = task.due_date
        ? new Date(task.due_date).toLocaleDateString(i18n.language, {
              month: 'short',
              day: 'numeric',
          })
        : null

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
            {...attributes}
            {...listeners}
            onClick={() => onClick?.(task)}
            className={`shrink-0 cursor-grab active:cursor-grabbing ${
                isDragging ? 'opacity-40' : ''
            }`}
        >
            <Card
                variant="default"
                className="rounded-lg p-4 transition-shadow hover:shadow-md"
            >
                <Card.Content className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-default-900 text-sm font-medium">
                            {task.title}
                        </p>

                        <Dropdown>
                            <Button
                                aria-label={t('tasks.actions.menuAria')}
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 min-w-0 rounded-md p-0"
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
                                        <Label>{t('tasks.actions.edit')}</Label>
                                    </Dropdown.Item>

                                    <Dropdown.Item
                                        id="delete"
                                        textValue={t('tasks.actions.delete')}
                                        variant="danger"
                                    >
                                        <Label>
                                            {t('tasks.actions.delete')}
                                        </Label>
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                    </div>

                    {task.labels && task.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {task.labels.map((label) => (
                                <Chip color="accent">{label}</Chip>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="text-default-400 flex items-center gap-1">
                            {formattedDate && (
                                <>
                                    <Calendar size={13} />
                                    <span className="text-xs">
                                        {formattedDate}
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            {task.assignee && (
                                <Avatar className="h-7 w-7 text-sm">
                                    <Avatar.Fallback className="bg-accent text-white">
                                        {task.assignee.initials}
                                    </Avatar.Fallback>
                                </Avatar>
                            )}
                        </div>
                    </div>
                </Card.Content>
            </Card>
        </div>
    )
}
