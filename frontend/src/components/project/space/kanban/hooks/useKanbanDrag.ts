import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useRef, useState } from 'react'
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
    const dragStartRef = useRef<{
        columns: Column[]
        fromStatus: TaskStatus
    } | null>(null)

    function findColumn(taskId: string) {
        return localColumns.find((col) =>
            col.tasks.some((t) => t.id === taskId),
        )
    }

    function handleDragStart({ active }: DragStartEvent) {
        const column = findColumn(active.id as string)
        const task = column?.tasks.find((t) => t.id === active.id)
        dragStartRef.current = column
            ? {
                  columns: localColumns.map((col) => ({
                      ...col,
                      tasks: [...col.tasks],
                  })),
                  fromStatus: column.id,
              }
            : null
        setActiveTask(task ?? null)
    }

    function moveTaskBetweenColumns(activeId: string, overId: string) {
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
        if (activeIndex === -1) return

        const task = {
            ...fromCol.tasks[activeIndex],
            status: overCol.id as TaskStatus,
        }

        if (fromCol.id === toCol.id) {
            const overIndex = toCol.tasks.findIndex((t) => t.id === overId)
            const targetIndex =
                overIndex === -1 ? fromCol.tasks.length - 1 : overIndex

            if (activeIndex === targetIndex) {
                const fromStatus = dragStartRef.current?.fromStatus

                if (fromStatus && fromStatus !== activeCol.id) {
                    return {
                        columns: localColumns,
                        fromStatus,
                        toStatus: activeCol.id,
                    }
                }

                return
            }

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
        return {
            columns: next,
            fromStatus: dragStartRef.current?.fromStatus ?? activeCol.id,
            toStatus: overCol.id,
        }
    }

    function handleDragOver({ active, over }: DragOverEvent) {
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string
        const activeCol = findColumn(activeId)
        const overCol =
            localColumns.find((c) => c.id === overId) ?? findColumn(overId)

        if (!activeCol || !overCol || activeCol.id === overCol.id) return

        moveTaskBetweenColumns(activeId, overId)
    }

    function handleDragEnd({ active, over }: DragEndEvent) {
        setActiveTask(null)

        if (!over) {
            if (dragStartRef.current) {
                setLocalColumns(dragStartRef.current.columns)
            }
            dragStartRef.current = null
            return
        }

        const activeId = active.id as string
        const result = moveTaskBetweenColumns(activeId, over.id as string)
        dragStartRef.current = null

        if (!result) return

        void Promise.resolve(
            onPersist?.({
                taskId: activeId,
                fromStatus: result.fromStatus,
                toStatus: result.toStatus,
                columns: result.columns,
            }),
        ).catch(() => {
            setLocalColumns(initialColumns)
        })
    }

    return {
        localColumns,
        setLocalColumns,
        activeTask,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
    }
}
