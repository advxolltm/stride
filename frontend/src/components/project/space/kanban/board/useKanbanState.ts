import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import type {
    Column,
    Task,
} from '../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../context/useTaskBoard'
import { useKanbanDrag } from '../hooks/useKanbanDrag'
import { useTaskDelete } from '../hooks/useTaskDelete'
import {
    useMoveTaskMutation,
    useUpdateTaskMutation,
} from '../../../../../store/features/tasks/task.api'

const TASK_ID_PARAM = 'taskID'
const LEGACY_TASK_ID_PARAM = 'taskId'
const VIEW_PARAM = 'view'

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

function getTargetProjectPosition(
    columns: Column[],
    taskId: string,
    toStatus: Task['status'],
    currentPosition: number,
) {
    const targetColumn = columns.find((column) => column.id === toStatus)
    const targetIndex =
        targetColumn?.tasks.findIndex((task) => task.id === taskId) ?? -1

    if (!targetColumn || targetIndex === -1) return null

    const previousTask = targetColumn.tasks[targetIndex - 1]
    const nextTask = targetColumn.tasks[targetIndex + 1]

    if (nextTask) {
        return currentPosition < nextTask.position
            ? nextTask.position - 1
            : nextTask.position
    }

    if (previousTask) {
        return currentPosition < previousTask.position
            ? previousTask.position
            : previousTask.position + 1
    }

    return currentPosition
}

export function useKanbanState() {
    const { t } = useTranslation('space')
    const { tasks, isLoading, statusOptions, projectId, isArchived } =
        useTaskBoard()
    const [updateTask] = useUpdateTaskMutation()
    const [moveTask] = useMoveTaskMutation()
    const [searchParams, setSearchParams] = useSearchParams()
    const isPersistingMoveRef = useRef(false)
    const taskIdFromUrl = searchParams.get(TASK_ID_PARAM)
    const legacyTaskIdFromUrl = searchParams.get(LEGACY_TASK_ID_PARAM)
    const requestedTaskId = taskIdFromUrl ?? legacyTaskIdFromUrl
    const requestedView = searchParams.get(VIEW_PARAM)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const syncTaskSearchParam = useCallback(
        (taskId: string | null, replace = false) => {
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
        },
        [setSearchParams],
    )
    const syncViewSearchParam = useCallback(
        (view: 'kanban' | 'list', replace = false) => {
            setSearchParams(
                (currentParams) => {
                    const nextParams = new URLSearchParams(currentParams)

                    nextParams.set(VIEW_PARAM, view)

                    return nextParams
                },
                { replace },
            )
        },
        [setSearchParams],
    )

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
    } = useKanbanDrag(
        serverColumns,
        async (payload) => {
            if (isArchived) return

            const movedTask = tasks.find((task) => task.id === payload.taskId)
            if (!movedTask || !projectId) return

            const nextPosition = getTargetProjectPosition(
                payload.columns,
                payload.taskId,
                payload.toStatus,
                movedTask.position,
            )

            if (nextPosition === null) return

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
        },
        isArchived,
    )
    const view: 'kanban' | 'list' =
        requestedView === 'list' ? 'list' : 'kanban'

    const selectedTask = useMemo(
        () =>
            tasks.find((task) => task.id === (selectedTaskId ?? requestedTaskId)) ??
            null,
        [requestedTaskId, selectedTaskId, tasks],
    )
    const isDrawerOpen = Boolean(selectedTask)

    const del = useTaskDelete((deleted) => {
        if (
            selectedTaskId === deleted.id ||
            requestedTaskId === deleted.id
        ) {
            setSelectedTaskId(null)
            syncTaskSearchParam(null, true)
        }
    })

    useEffect(() => {
        if (isPersistingMoveRef.current) return

        setLocalColumns(serverColumns)
    }, [serverColumns, setLocalColumns])

    useEffect(() => {
        if (requestedView !== 'kanban' && requestedView !== 'list') {
            syncViewSearchParam('kanban', true)
            return
        }

        if (legacyTaskIdFromUrl && !taskIdFromUrl) {
            syncTaskSearchParam(legacyTaskIdFromUrl, true)
            return
        }

        if (requestedTaskId && !isLoading && !selectedTask) {
            syncTaskSearchParam(null, true)
        }
    }, [
        isLoading,
        legacyTaskIdFromUrl,
        requestedTaskId,
        requestedView,
        selectedTask,
        syncTaskSearchParam,
        syncViewSearchParam,
        taskIdFromUrl,
    ])

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
        setView: (nextView: 'kanban' | 'list') => {
            syncViewSearchParam(nextView)
        },
        selectedTask,
        isDrawerOpen,
        handleTaskClick: (task: Task) => {
            setSelectedTaskId(task.id)
        },
        handleDrawerOpenChange: (open: boolean) => {
            if (!open) {
                setSelectedTaskId(null)
                syncTaskSearchParam(null)
            }
        },
    }
}
