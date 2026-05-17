import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { Button, Chip, SearchField, Tabs } from '@heroui/react'
import { Archive, LayoutGrid, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../../../shared/components'
import type { Task } from '../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../context/useTaskBoard'
import { TaskEditDrawer } from '../task/drawer/TaskEditDrawer'
import { KanbanCard } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import { useKanbanState } from './useKanbanState'

function taskMatchesSearch(task: Task, query: string) {
    const searchableText = [
        task.title,
        task.description,
        ...((task.assignees ?? []).flatMap((assignee) => [
            assignee.user.fullName,
            assignee.user.username,
            assignee.user.email,
        ])),
        ...((task.skills ?? []).flatMap((skill) => [
            skill.name,
            skill.description,
        ])),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

    return searchableText.includes(query)
}

export function KanbanBoard() {
    const { t } = useTranslation('space')
    const { isLoading, isArchived } = useTaskBoard()
    const [taskSearch, setTaskSearch] = useState('')
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
    const normalizedTaskSearch = taskSearch.trim().toLowerCase()
    const visibleColumns = useMemo(() => {
        if (!normalizedTaskSearch) return localColumns

        return localColumns.map((column) => ({
            ...column,
            tasks: column.tasks.filter((task) =>
                taskMatchesSearch(task, normalizedTaskSearch),
            ),
        }))
    }, [localColumns, normalizedTaskSearch])

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
        <div className="flex flex-col gap-4 px-6">
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

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <SearchField
                            name="task-search"
                            value={taskSearch}
                            onChange={setTaskSearch}
                            aria-label={t('tasks.actions.searchTasks')}
                            className="w-80"
                        >
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input
                                    placeholder={t('tasks.actions.searchTasks')}
                                />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>

                        {isArchived && (
                            <Chip size="sm" variant="soft" className="flex flex-row gap-2 items-center shrink-0">
                                <Archive size={14} />
                                {t('tasks.messages.archivedReadOnly')}
                            </Chip>
                        )}
                        <Button
                            size="sm"
                            variant="primary"
                            isDisabled={isArchived}
                        >
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
                                {visibleColumns.map((col) => (
                                    <KanbanColumn
                                        key={col.id}
                                        column={col}
                                        onTaskClick={handleTaskClick}
                                        onTaskDelete={promptDelete}
                                        readOnly={isArchived}
                                    />
                                ))}
                            </div>
                        </div>

                        {!isArchived && (
                            <DragOverlay>
                                {activeTask && <KanbanCard task={activeTask} />}
                            </DragOverlay>
                        )}
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
