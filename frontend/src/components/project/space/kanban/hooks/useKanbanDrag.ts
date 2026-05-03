import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useState } from 'react'
import type {
    Column,
    Task,
    TaskStatus,
} from '../../../../../store/features/tasks/task.types'

interface DragPersistPayload {
    taskId: string
    fromStatus: TaskStatus
    toStatus: TaskStatus
    columns: Column[]
}

export function useKanbanDrag(
    initialColumns: Column[],
    onPersist?: (payload: DragPersistPayload) => void | Promise<void>,
) {
    const [localColumns, setLocalColumns] = useState<Column[]>(initialColumns)
    const [activeTask, setActiveTask] = useState<Task | null>(null)

    function findColumn(taskId: string) {
        return localColumns.find((col) =>
            col.tasks.some((t) => t.id === taskId),
        )
    }

    function handleDragStart({ active }: DragStartEvent) {
        const task = findColumn(active.id as string)?.tasks.find(
            (t) => t.id === active.id,
        )
        setActiveTask(task ?? null)
    }

    function handleDragEnd({ active, over }: DragEndEvent) {
        setActiveTask(null)
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string
        const activeCol = findColumn(activeId)
        const overCol =
            localColumns.find((c) => c.id === overId) ?? findColumn(overId)
        if (!activeCol || !overCol) return

        const next = localColumns.map((col) => ({
            ...col,
            tasks: [...col.tasks],
        }))
        const fromCol = next.find((c) => c.id === activeCol.id)!
        const toCol = next.find((c) => c.id === overCol.id)!
        const activeIndex = fromCol.tasks.findIndex((t) => t.id === activeId)
        const task = {
            ...fromCol.tasks[activeIndex],
            status: overCol.id as TaskStatus,
        }

        if (fromCol.id === toCol.id) {
            const overIndex = toCol.tasks.findIndex((t) => t.id === overId)
            const targetIndex =
                overIndex === -1 ? fromCol.tasks.length - 1 : overIndex

            if (activeIndex === targetIndex) return

            fromCol.tasks = arrayMove(fromCol.tasks, activeIndex, targetIndex)
        } else {
            fromCol.tasks.splice(activeIndex, 1)
            const overIndex = toCol.tasks.findIndex((t) => t.id === overId)
            if (overIndex === -1) {
                toCol.tasks.push(task)
            } else {
                toCol.tasks.splice(overIndex, 0, task)
            }
        }

        setLocalColumns(next)
        void onPersist?.({
            taskId: activeId,
            fromStatus: activeCol.id,
            toStatus: overCol.id,
            columns: next,
        })
    }

    return {
        localColumns,
        setLocalColumns,
        activeTask,
        handleDragStart,
        handleDragEnd,
    }
}
