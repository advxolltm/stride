import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { Button, Tabs } from '@heroui/react'
import { LayoutGrid, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../../../shared/components'
import { useTaskBoard } from '../context/useTaskBoard'
import { TaskEditDrawer } from '../task/drawer/TaskEditDrawer'
import { KanbanCard } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import { useKanbanState } from './useKanbanState'

export function KanbanBoard() {
    const { t } = useTranslation('space')
    const { isLoading } = useTaskBoard()
    const {
        localColumns,
        activeTask,
        view,
        setView,
        selectedTask,
        isDrawerOpen,
        handleTaskClick,
        handleDrawerOpenChange,
        taskToDelete,
        isDeleteOpen,
        promptDelete,
        confirmDelete,
        cancelDelete,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
    } = useKanbanState()

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    )

    if (isLoading) {
        return (
            <div className="flex h-24 items-center justify-center">
                <span className="text-default-500">
                    {t('tasks.messages.loading')}
                </span>
            </div>
        )
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
                            {/* TODO: implement list view  later if there is time*/}
                            {/* <Tabs.Tab className="flex flex-row gap-2" id="list">
                                <List size={16} />
                                {t('tasks.tabs.list')}
                                <Tabs.Indicator />
                            </Tabs.Tab> */}
                        </Tabs.List>
                    </Tabs.ListContainer>

                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary">
                            <UserPlus size={16} />
                            {t('tasks.actions.assign')}
                        </Button>
                    </div>
                </div>

                <Tabs.Panel id="kanban" className="pt-4">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="h-[calc(100vh-320px)] min-h-[420px] overflow-x-auto">
                            <div className="flex h-full min-h-0 gap-6">
                                {localColumns.map((col) => (
                                    <KanbanColumn
                                        key={col.id}
                                        column={col}
                                        onTaskClick={handleTaskClick}
                                        onTaskDelete={promptDelete}
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
            />

            <ConfirmDialog
                isOpen={isDeleteOpen && Boolean(taskToDelete)}
                onOpenChange={cancelDelete}
                title="Delete task"
                message={
                    taskToDelete
                        ? `Delete "${taskToDelete.title}"? This action cannot be undone.`
                        : 'Delete this task? This action cannot be undone.'
                }
                confirmLabel="Delete task"
                confirmVariant="danger"
                onConfirm={confirmDelete}
            />
        </div>
    )
}
