import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@heroui/react'
import { CheckCircle2, Circle, Clock3, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
    Column,
    Task,
} from '../../../../../store/features/tasks/task.types'
import { AddTaskForm } from './AddTaskForm'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
    column: Column
    onTaskClick: (task: Task) => void
    onTaskDelete: (task: Task) => void
}

const columnIcons: Record<Column['id'], typeof Circle> = {
    todo: Circle,
    in_progress: Clock3,
    done: CheckCircle2,
}

export function KanbanColumn({
    column,
    onTaskClick,
    onTaskDelete,
}: KanbanColumnProps) {
    const { t } = useTranslation('space')
    const { setNodeRef } = useDroppable({ id: column.id })
    const [isAddingTask, setIsAddingTask] = useState(false)
    const Icon = columnIcons[column.id]

    return (
        <div className="bg-surface-secondary border-border flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-xl border p-3 shadow-sm">
            <div className="border-border/70 -mx-3 border-b pb-2">
                <div className="flex items-center gap-2 px-3">
                    <Icon
                        size={14}
                        style={{ color: column.dotColor }}
                        className="shrink-0"
                    />
                    <span className="text-foreground text-sm font-semibold">
                        {column.label}
                    </span>
                    <span className="text-muted text-xs">
                        {column.tasks.length}
                    </span>
                </div>
            </div>

            {/* Add Task Form (NOT scrollable anymore) */}
            {isAddingTask && (
                <AddTaskForm
                    columnId={column.id}
                    onCancel={() => setIsAddingTask(false)}
                />
            )}

            <SortableContext
                items={column.tasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
            >
                <div
                    ref={setNodeRef}
                    className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
                >
                    {column.tasks.map((task) => (
                        <KanbanCard
                            key={task.id}
                            task={task}
                            onClick={onTaskClick}
                            onEdit={onTaskClick}
                            onDelete={onTaskDelete}
                        />
                    ))}
                </div>
            </SortableContext>

            <Button
                variant="ghost"
                size="sm"
                onPress={() => setIsAddingTask(true)}
                className="text-muted hover:text-foreground mt-auto w-full justify-start gap-2"
            >
                <Plus size={14} />
                {t('tasks.columns.addTask')}
            </Button>
        </div>
    )
}
