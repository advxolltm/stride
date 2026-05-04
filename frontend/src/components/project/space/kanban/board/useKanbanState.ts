import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import type { Task } from '../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../context/useTaskBoard'
import { useKanbanDrag } from '../hooks/useKanbanDrag'
import { useTaskDelete } from '../hooks/useTaskDelete'
import {
    useMoveTaskMutation,
    useUpdateTaskMutation,
} from '../../../../../store/features/tasks/task.api'

const TASK_ID_PARAM = 'taskID'
const LEGACY_TASK_ID_PARAM = 'taskId'

function getColumnColor(status: 'todo' | 'in_progress' | 'done') {
    switch (status) {
        case 'todo':
            return '#71717a'
        case 'in_progress':
            return '#3b82f6'
        case 'done':
            return '#22c55e'
    }
}

export function useKanbanState() {
    const { t } = useTranslation('space')
    const { tasks, isLoading, statusOptions, projectId } = useTaskBoard()
    const [updateTask] = useUpdateTaskMutation()
    const [moveTask] = useMoveTaskMutation()
    const [searchParams, setSearchParams] = useSearchParams()
    const isPersistingMoveRef = useRef(false)
    const taskIdFromUrl = searchParams.get(TASK_ID_PARAM)
    const legacyTaskIdFromUrl = searchParams.get(LEGACY_TASK_ID_PARAM)
    const requestedTaskId = taskIdFromUrl ?? legacyTaskIdFromUrl

    function syncTaskSearchParam(taskId: string | null, replace = false) {
        setSearchParams(
            (currentParams) => {
                const nextParams = new URLSearchParams(currentParams)

                nextParams.delete(LEGACY_TASK_ID_PARAM)

                if (taskId) {
                    nextParams.set(TASK_ID_PARAM, taskId)
                } else {
                    nextParams.delete(TASK_ID_PARAM)
                }

                return nextParams
            },
            { replace },
        )
    }

    const serverColumns = useMemo(
        () =>
            statusOptions.map((option) => ({
                id: option.id,
                label: option.label,
                dotColor: getColumnColor(option.id),
                tasks: tasks
                    .filter((task) => task.status === option.id)
                    .sort((a, b) => a.position - b.position),
            })),
        [statusOptions, tasks],
    )

    const {
        localColumns,
        setLocalColumns,
        activeTask,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
    } = useKanbanDrag(serverColumns, async (payload) => {
        const movedTask = tasks.find((task) => task.id === payload.taskId)
        if (!movedTask || !projectId) return

        const nextPosition = payload.columns
            .flatMap((column) => column.tasks)
            .findIndex((task) => task.id === payload.taskId)

        if (nextPosition === -1) return

        isPersistingMoveRef.current = true

        try {
            if (payload.fromStatus !== payload.toStatus) {
                await updateTask({
                    taskId: payload.taskId,
                    projectId,
                    body: { status: payload.toStatus },
                }).unwrap()
            }

            if (movedTask.position !== nextPosition) {
                await moveTask({
                    taskId: payload.taskId,
                    projectId,
                    body: { position: nextPosition },
                }).unwrap()
            }

            toast.success(t('tasks.messages.moveSuccess'))
        } catch {
            toast.danger(t('tasks.messages.moveError'))
            throw new Error('Failed to persist task move')
        } finally {
            isPersistingMoveRef.current = false
            setLocalColumns(payload.columns)
        }
    })
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const [view, setView] = useState<'kanban' | 'list'>('kanban')

    const selectedTask = useMemo(
        () => tasks.find((t) => t.id === selectedTaskId) ?? null,
        [tasks, selectedTaskId],
    )

    const del = useTaskDelete((deleted) => {
        if (selectedTaskId === deleted.id) {
            setDrawerOpen(false)
            setSelectedTaskId(null)
            syncTaskSearchParam(null, true)
        }
    })

    useEffect(() => {
        if (isPersistingMoveRef.current) return

        setLocalColumns(serverColumns)
    }, [serverColumns, setLocalColumns])

    useEffect(() => {
        if (!requestedTaskId) {
            setDrawerOpen(false)
            setSelectedTaskId(null)
            return
        }

        const taskFromUrl = tasks.find((task) => task.id === requestedTaskId)

        if (taskFromUrl) {
            setSelectedTaskId(taskFromUrl.id)
            setDrawerOpen(true)

            if (!taskIdFromUrl && legacyTaskIdFromUrl) {
                syncTaskSearchParam(legacyTaskIdFromUrl, true)
            }

            return
        }

        if (!isLoading) {
            setDrawerOpen(false)
            setSelectedTaskId(null)
            syncTaskSearchParam(null, true)
        }
    }, [isLoading, legacyTaskIdFromUrl, requestedTaskId, taskIdFromUrl, tasks])

    return {
        ...del,
        localColumns,
        activeTask,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        isLoading,
        statusOptions,
        view,
        setView,
        selectedTask,
        isDrawerOpen,
        handleTaskClick: (task: Task) => {
            setSelectedTaskId(task.id)
            setDrawerOpen(true)
            syncTaskSearchParam(task.id)
        },
        handleDrawerOpenChange: (open: boolean) => {
            setDrawerOpen(open)

            if (!open) {
                setSelectedTaskId(null)
                syncTaskSearchParam(null)
            }
        },
    }
}
