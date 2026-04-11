import { Button } from '@heroui/react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CheckCircle2, Circle, Clock3, Plus } from 'lucide-react'
import { KanbanCard } from './KanbanCard'
import type { Column, Task } from './types'
interface KanbanColumnProps {
    column: Column
    onAddTask?: (status: Column['id']) => void
    onTaskClick?: (task: Task) => void
    onTaskDelete?: (task: Task) => void
}

const columnIcons: Record<Column['id'], typeof Circle> = {
    todo: Circle,
    in_progress: Clock3,
    done: CheckCircle2,
}

export function KanbanColumn({
    column,
    onAddTask,
    onTaskClick,
    onTaskDelete,
}: KanbanColumnProps) {
    const { setNodeRef } = useDroppable({ id: column.id })
    const Icon = columnIcons[column.id]

    return (
        <div className="bg-surface-secondary border-border flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-xl border p-3 shadow-sm">
            {/* Column header */}
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
                onPress={() => onAddTask?.(column.id)}
                className="text-muted hover:text-foreground mt-auto w-full justify-start gap-2"
            >
                <Plus size={14} />
                Add task
            </Button>
        </div>
    )
}
