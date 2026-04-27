import { useState } from 'react'
import { useDeleteTaskMutation } from '../../../../../store/features/tasks/task.api'
import type { Task } from '../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../context/useTaskBoard'

export function useTaskDelete(onDeleted?: (task: Task) => void) {
    const { projectId } = useTaskBoard()
    const [deleteTask] = useDeleteTaskMutation()
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
    const [isDeleteOpen, setDeleteOpen] = useState(false)

    function promptDelete(task: Task) {
        setTaskToDelete(task)
        setDeleteOpen(true)
    }

    async function confirmDelete() {
        if (!taskToDelete) return
        try {
            await deleteTask({ taskId: taskToDelete.id, projectId }).unwrap()
            onDeleted?.(taskToDelete)
        } catch {
            // TODO: toast
        } finally {
            setDeleteOpen(false)
            setTaskToDelete(null)
        }
    }

    function cancelDelete(open: boolean) {
        setDeleteOpen(open)
        if (!open) setTaskToDelete(null)
    }

    return {
        taskToDelete,
        isDeleteOpen,
        promptDelete,
        confirmDelete,
        cancelDelete,
    }
}
