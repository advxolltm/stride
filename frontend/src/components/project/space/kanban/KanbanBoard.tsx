import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Button, Tabs } from '@heroui/react'
import { LayoutGrid, List, Plus, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../../shared/components'
import { AddTaskModal } from './AddTaskModal'
import { KanbanCard } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import { TaskEditDrawer } from './TaskEditDrawer'
import type { Column, Task, TaskStatus } from './types'

export function KanbanBoard() {
    const { t } = useTranslation('space')

    const INITIAL_COLUMNS: Column[] = [
        {
            id: 'todo',
            label: t('tasks.columns.todo'),
            dotColor: '#71717a',
            tasks: [
                {
                    id: '1',
                    project_id: 'p1',
                    created_by: 'u1',
                    title: 'Design landing page mockups',
                    status: 'todo',
                    position: 0,
                    due_date: '2026-04-15',
                    priority: 'high',
                    labels: ['Design'],
                    assignee: { id: 'sk', initials: 'SK', color: '#7c3aed' },
                    created_at: '',
                    updated_at: '',
                },
                {
                    id: '2',
                    project_id: 'p1',
                    created_by: 'u1',
                    title: 'Write campaign copy for email blast',
                    status: 'todo',
                    position: 1,
                    due_date: '2026-04-18',
                    priority: 'medium',
                    labels: ['Content'],
                    assignee: { id: 'mr', initials: 'MR', color: '#0891b2' },
                    created_at: '',
                    updated_at: '',
                },
            ],
        },
        {
            id: 'in_progress',
            label: t('tasks.columns.inProgress'),
            dotColor: '#3b82f6',
            tasks: [
                {
                    id: '3',
                    project_id: 'p1',
                    created_by: 'u1',
                    title: 'Set up analytics tracking',
                    status: 'in_progress',
                    position: 0,
                    due_date: '2026-04-12',
                    priority: 'high',
                    labels: ['Dev'],
                    assignee: { id: 'at', initials: 'AT', color: '#059669' },
                    created_at: '',
                    updated_at: '',
                },
            ],
        },
        {
            id: 'done',
            label: t('tasks.columns.done'),
            dotColor: '#22c55e',
            tasks: [
                {
                    id: '6',
                    project_id: 'p1',
                    created_by: 'u1',
                    title: 'Finalize brand guidelines',
                    status: 'done',
                    position: 0,
                    due_date: '2026-04-10',
                    priority: 'high',
                    labels: ['Design'],
                    assignee: { id: 'mr2', initials: 'MR', color: '#0891b2' },
                    created_at: '',
                    updated_at: '',
                    completed_at: '2026-04-10',
                },
            ],
        },
    ]

    const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS)
    const [activeTask, setActiveTask] = useState<Task | null>(null)
    const [view, setView] = useState<'kanban' | 'list'>('kanban')
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const [isAddOpen, setAddOpen] = useState(false)
    const [addStatus, setAddStatus] = useState<TaskStatus>('todo')
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
    const [isDeleteOpen, setDeleteOpen] = useState(false)

    const defaultAssignees = useMemo(
        () => [
            {
                id: 'sk',
                name: 'Sara Kim',
                initials: 'SK',
                color: '#7c3aed',
            },
            {
                id: 'mr',
                name: 'Maya Rivera',
                initials: 'MR',
                color: '#0891b2',
            },
            {
                id: 'at',
                name: 'Alex Tran',
                initials: 'AT',
                color: '#059669',
            },
        ],
        [],
    )

    const assigneeOptions = useMemo(() => {
        const mapped = new Map(defaultAssignees.map((item) => [item.id, item]))
        columns.forEach((col) =>
            col.tasks.forEach((task) => {
                if (!mapped.has(task.assignee.id)) {
                    mapped.set(task.assignee.id, {
                        id: task.assignee.id,
                        name: `User ${task.assignee.initials}`,
                        initials: task.assignee.initials,
                        color: task.assignee.color ?? '#7c3aed',
                    })
                }
            }),
        )
        return Array.from(mapped.values())
    }, [columns, defaultAssignees])

    const labelOptions = useMemo(() => {
        const labels = new Set<string>()
        columns.forEach((col) =>
            col.tasks.forEach((task) => {
                task.labels?.forEach((label) => labels.add(label))
            }),
        )
        return Array.from(labels.values())
    }, [columns])

    const statusOptions = useMemo(
        () =>
            columns.map((col) => ({
                id: col.id,
                label: col.label,
            })),
        [columns],
    )

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    )

    function findColumn(taskId: string) {
        return columns.find((col) => col.tasks.some((t) => t.id === taskId))
    }

    function handleDragStart({ active }: DragStartEvent) {
        const col = findColumn(active.id as string)
        const task = col?.tasks.find((t) => t.id === active.id)
        setActiveTask(task ?? null)
    }

    function handleDragEnd({ active, over }: DragEndEvent) {
        setActiveTask(null)
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeCol = findColumn(activeId)
        const overCol =
            columns.find((c) => c.id === overId) ?? findColumn(overId)

        if (!activeCol || !overCol) return

        setColumns((prev) => {
            const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }))

            const fromCol = next.find((c) => c.id === activeCol.id)!
            const toCol = next.find((c) => c.id === overCol.id)!

            const activeIndex = fromCol.tasks.findIndex(
                (t) => t.id === activeId,
            )
            const task = {
                ...fromCol.tasks[activeIndex],
                status: overCol.id as TaskStatus,
            }

            if (fromCol.id === toCol.id) {
                const overIndex = toCol.tasks.findIndex((t) => t.id === overId)
                fromCol.tasks = arrayMove(
                    fromCol.tasks,
                    activeIndex,
                    overIndex === -1 ? fromCol.tasks.length - 1 : overIndex,
                )
            } else {
                fromCol.tasks.splice(activeIndex, 1)
                const overIndex = toCol.tasks.findIndex((t) => t.id === overId)
                if (overIndex === -1) {
                    toCol.tasks.push(task)
                } else {
                    toCol.tasks.splice(overIndex, 0, task)
                }
            }

            return next
        })
    }

    function handleTaskClick(task: Task) {
        setSelectedTask(task)
        setDrawerOpen(true)
    }

    function handleDrawerOpenChange(open: boolean) {
        setDrawerOpen(open)
        if (!open) {
            setSelectedTask(null)
        }
    }

    function handleSaveTask(updated: Task) {
        setColumns((prev) => {
            const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }))
            const fromCol = next.find((col) =>
                col.tasks.some((task) => task.id === updated.id),
            )

            if (!fromCol) return prev

            const fromIndex = fromCol.tasks.findIndex(
                (task) => task.id === updated.id,
            )
            fromCol.tasks.splice(fromIndex, 1)

            const toCol =
                next.find((col) => col.id === updated.status) ?? fromCol

            if (toCol.id === fromCol.id) {
                toCol.tasks.splice(fromIndex, 0, updated)
            } else {
                toCol.tasks.push(updated)
            }

            return next
        })

        setDrawerOpen(false)
        setSelectedTask(null)
    }

    function handleAddTask(status: TaskStatus = 'todo') {
        setAddStatus(status)
        setAddOpen(true)
    }

    function handleAddOpenChange(open: boolean) {
        setAddOpen(open)
    }

    function handleCreateTask(task: Task) {
        setColumns((prev) => {
            const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }))
            const targetCol =
                next.find((col) => col.id === task.status) ?? next[0]

            const nextTask = {
                ...task,
                position: targetCol.tasks.length,
            }

            targetCol.tasks.push(nextTask)
            return next
        })

        setAddOpen(false)
    }

    function handleDeleteRequest(task: Task) {
        setTaskToDelete(task)
        setDeleteOpen(true)
    }

    function handleDeleteOpenChange(open: boolean) {
        setDeleteOpen(open)
        if (!open) {
            setTaskToDelete(null)
        }
    }

    function handleDeleteConfirm() {
        if (!taskToDelete) return
        setColumns((prev) =>
            prev.map((col) => ({
                ...col,
                tasks: col.tasks.filter((task) => task.id !== taskToDelete.id),
            })),
        )

        if (selectedTask?.id === taskToDelete.id) {
            setDrawerOpen(false)
            setSelectedTask(null)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <Tabs
                variant="secondary"
                className="w-full"
                selectedKey={view}
                onSelectionChange={(key) => setView(key as 'kanban' | 'list')}
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Tabs.ListContainer className="overflow-x-auto">
                        <Tabs.List
                            aria-label={t('tasks.tabs.ariaLabel')}
                            className="flex gap-4"
                        >
                            <Tabs.Tab
                                className="flex flex-row gap-2"
                                id="kanban"
                            >
                                <LayoutGrid size={16} />
                                {t('tasks.tabs.board')}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab className="flex flex-row gap-2" id="list">
                                <List size={16} />
                                {t('tasks.tabs.list')}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs.ListContainer>

                    <div className="flex items-center gap-2">
                        {/*TODO: Un comment and implement filter functionality}
                        {/* <Button size="sm" variant="secondary">
                            <Filter size={16} />
                            {t('tasks.actions.filter')}
                        </Button> */}
                        <Button size="sm" variant="secondary">
                            <UserPlus size={16} />
                            {t('tasks.actions.assign')}
                        </Button>
                        <Button size="sm" onPress={() => handleAddTask()}>
                            <Plus size={16} />
                            {t('tasks.actions.add')}
                        </Button>
                    </div>
                </div>

                <Tabs.Panel id="kanban" className="pt-4">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="h-[calc(100vh-320px)] min-h-[420px] overflow-hidden">
                            <div className="grid h-full min-h-0 grid-cols-3 grid-rows-1 gap-6">
                                {columns.map((col) => (
                                    <KanbanColumn
                                        key={col.id}
                                        column={col}
                                        onAddTask={handleAddTask}
                                        onTaskClick={handleTaskClick}
                                        onTaskDelete={handleDeleteRequest}
                                    />
                                ))}
                            </div>
                        </div>

                        <DragOverlay>
                            {activeTask && <KanbanCard task={activeTask} />}
                        </DragOverlay>
                    </DndContext>
                </Tabs.Panel>

                <Tabs.Panel id="list" className="pt-4">
                    <div className="text-default-500 text-sm">
                        {t('tasks.messages.listComingSoon')}
                    </div>
                </Tabs.Panel>
            </Tabs>
            <TaskEditDrawer
                task={selectedTask}
                isOpen={isDrawerOpen && Boolean(selectedTask)}
                onOpenChange={handleDrawerOpenChange}
                onSave={handleSaveTask}
                assignees={assigneeOptions}
                labelOptions={labelOptions}
                statusOptions={statusOptions}
            />
            <AddTaskModal
                isOpen={isAddOpen}
                onOpenChange={handleAddOpenChange}
                onSave={handleCreateTask}
                assignees={assigneeOptions}
                labelOptions={labelOptions}
                statusOptions={statusOptions}
                defaultStatus={addStatus}
            />
            <ConfirmDialog
                isOpen={isDeleteOpen && Boolean(taskToDelete)}
                onOpenChange={handleDeleteOpenChange}
                title="Delete task"
                message={
                    taskToDelete
                        ? `Delete "${taskToDelete.title}"? This action cannot be undone.`
                        : 'Delete this task? This action cannot be undone.'
                }
                confirmLabel="Delete task"
                confirmVariant="danger"
                onConfirm={handleDeleteConfirm}
            />
        </div>
    )
}
