import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    Button,
    Dropdown,
    SearchField,
    Tabs,
    toast,
} from '@heroui/react'
import {
    Check,
    LayoutGrid,
    List,
    ListPlus,
    SlidersHorizontal,
    UserPlus,
} from 'lucide-react'
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../../../shared/components'
import type { Task } from '../../../../../store/features/tasks/task.types'
import { ArchivedReadOnlyChip } from '../../shared/ArchivedReadOnlyChip'
import { useTaskBoard } from '../context/useTaskBoard'
import { SchedulerFlowModal } from '../scheduler/SchedulerFlowModal'
import type {
    SchedulerMemberOption,
    SchedulerTaskOption,
} from '../scheduler/types'
import { TaskEditDrawer } from '../task/drawer/TaskEditDrawer'
import { KanbanCard } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import {
    type ColumnWidthMap,
    type ListColumnId,
    type OptionalColumnId,
    DEFAULT_TASK_LIST_COLUMN_WIDTHS,
    TASK_LIST_COLUMN_MAX_WIDTHS,
    TASK_LIST_COLUMN_MIN_WIDTHS,
    TASK_LIST_COLUMN_ORDER,
} from './taskList.config'
import { TaskListView } from './TaskListView'
import { useKanbanState } from './useKanbanState'

const TASK_LIST_PREFERENCES_STORAGE_KEY = 'task-list-preferences'

interface TaskListProjectPreferences {
    visibleColumns?: OptionalColumnId[]
    columnWidths?: Partial<ColumnWidthMap>
}

type TaskListPreferencesMap = Record<string, TaskListProjectPreferences>

function normalizeVisibleListColumns(
    visibleColumns?: OptionalColumnId[],
): OptionalColumnId[] {
    const savedColumns = new Set(visibleColumns ?? [])
    savedColumns.add('description')

    const normalized = TASK_LIST_COLUMN_ORDER.filter((columnId) =>
        savedColumns.has(columnId),
    )

    return normalized.length > 0 ? normalized : [...TASK_LIST_COLUMN_ORDER]
}

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
    const { isLoading, isArchived, members, projectId } = useTaskBoard()
    const [taskSearch, setTaskSearch] = useState('')
    const [isSchedulerOpen, setSchedulerOpen] = useState(false)
    const [isListAddingTask, setListAddingTask] = useState(false)
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
    const listPreferences = useMemo<TaskListProjectPreferences>(() => {
        if (typeof window === 'undefined') {
            return {}
        }

        const rawValue = window.localStorage.getItem(
            TASK_LIST_PREFERENCES_STORAGE_KEY,
        )
        if (!rawValue) {
            return {}
        }

        try {
            const parsed = JSON.parse(rawValue) as TaskListPreferencesMap
            return parsed[projectId] ?? {}
        } catch {
            return {}
        }
    }, [projectId])

    const [visibleListColumns, setVisibleListColumns] = useState<
        OptionalColumnId[]
    >(() => normalizeVisibleListColumns(listPreferences.visibleColumns))
    const [listColumnWidths, setListColumnWidths] = useState<ColumnWidthMap>(
        () => {
            return {
                ...DEFAULT_TASK_LIST_COLUMN_WIDTHS,
                ...listPreferences.columnWidths,
            }
        },
    )

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

    const schedulerTasks = useMemo<SchedulerTaskOption[]>(
        () =>
            localColumns.flatMap((column) =>
                column.tasks
                    .filter((task) => task.status !== 'done')
                    .map((task) => ({
                        id: task.id,
                        title: task.title,
                        status: task.status,
                        status_label: column.label,
                    })),
            ),
        [localColumns],
    )

    const schedulerMembers = useMemo<SchedulerMemberOption[]>(
        () =>
            members.map((member) => ({
                id: member.userId,
                name: member.user.fullName ?? member.user.username,
                initials: (
                    member.user.fullName ?? member.user.username
                )
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase(),
                avatarUrl: member.user.avatarSmallUrl ?? member.user.avatarUrl,
                working_hours: 40,
            })),
        [members],
    )

    useEffect(() => {
        const rawValue = window.localStorage.getItem(
            TASK_LIST_PREFERENCES_STORAGE_KEY,
        )

        let currentPreferences: TaskListPreferencesMap = {}
        if (rawValue) {
            try {
                currentPreferences = JSON.parse(rawValue) as TaskListPreferencesMap
            } catch {
                currentPreferences = {}
            }
        }

        currentPreferences[projectId] = {
            visibleColumns: visibleListColumns,
            columnWidths: listColumnWidths,
        }

        window.localStorage.setItem(
            TASK_LIST_PREFERENCES_STORAGE_KEY,
            JSON.stringify(currentPreferences),
        )
    }, [listColumnWidths, projectId, visibleListColumns])

    function handleSchedulerConfirm() {
        toast.info('Scheduler assignments are mocked for now.')
    }

    function toggleListColumn(columnId: OptionalColumnId) {
        setVisibleListColumns((current) => {
            if (current.includes(columnId)) {
                const next = current.filter((item) => item !== columnId)
                return next.length > 0 ? next : current
            }

            return TASK_LIST_COLUMN_ORDER.filter((item) =>
                [...current, columnId].includes(item),
            )
        })
    }

    function handleListColumnResizeStart(
        columnId: ListColumnId,
        event: ReactMouseEvent<HTMLButtonElement>,
    ) {
        event.preventDefault()
        event.stopPropagation()

        const startX = event.clientX
        const startWidth = listColumnWidths[columnId]

        function handlePointerMove(moveEvent: MouseEvent) {
            const nextWidth = Math.max(
                TASK_LIST_COLUMN_MIN_WIDTHS[columnId],
                Math.min(
                    TASK_LIST_COLUMN_MAX_WIDTHS[columnId],
                    startWidth + (moveEvent.clientX - startX),
                ),
            )

            setListColumnWidths((current) => ({
                ...current,
                [columnId]: nextWidth,
            }))
        }

        function handlePointerUp() {
            window.removeEventListener('mousemove', handlePointerMove)
            window.removeEventListener('mouseup', handlePointerUp)
        }

        window.addEventListener('mousemove', handlePointerMove)
        window.addEventListener('mouseup', handlePointerUp)
    }

    function renderToolbar(showListActions: boolean) {
        return (
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

                    {showListActions && (
                        <Dropdown>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="gap-2"
                            >
                                <SlidersHorizontal size={16} />
                                {t('tasks.list.columnsButton')}
                            </Button>

                            <Dropdown.Popover>
                                <Dropdown.Menu
                                    aria-label={t('tasks.list.columnsButton')}
                                    selectionMode="multiple"
                                    selectedKeys={new Set(visibleListColumns)}
                                >
                                    {TASK_LIST_COLUMN_ORDER.map((columnId) => (
                                        <Dropdown.Item
                                            key={columnId}
                                            id={columnId}
                                            textValue={t(
                                                `tasks.list.columns.${columnId}`,
                                            )}
                                            onAction={() =>
                                                toggleListColumn(columnId)
                                            }
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <span>
                                                    {t(
                                                        `tasks.list.columns.${columnId}`,
                                                    )}
                                                </span>
                                                <span className="text-primary flex h-4 w-4 items-center justify-center">
                                                    {visibleListColumns.includes(
                                                        columnId,
                                                    ) && <Check size={14} />}
                                                </span>
                                            </div>
                                        </Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                    )}

                    {showListActions && !isArchived && !isListAddingTask && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => setListAddingTask(true)}
                            className="gap-2"
                        >
                            <ListPlus size={16} />
                            {t('tasks.actions.add')}
                        </Button>
                    )}

                    {isArchived && <ArchivedReadOnlyChip />}
                    <Button
                        size="sm"
                        variant="primary"
                        isDisabled={isArchived}
                        onPress={() => setSchedulerOpen(true)}
                    >
                        <UserPlus size={16} />
                        {t('tasks.actions.assign')}
                    </Button>
            </div>
        )
    }

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
            <div className="flex flex-wrap items-start justify-between gap-3">
                <Tabs
                    variant="secondary"
                    className="w-auto flex-none"
                    selectedKey={view}
                    onSelectionChange={(key) => setView(key as 'kanban' | 'list')}
                >
                    <Tabs.ListContainer>
                        <Tabs.List aria-label={t('tasks.tabs.ariaLabel')}>
                            <Tabs.Tab className="flex flex-row gap-2" id="kanban">
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
                </Tabs>

                {renderToolbar(view === 'list')}
            </div>

            {view === 'kanban' ? (
                <div className="pt-1">
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
                </div>
            ) : (
                <div className="h-[calc(100vh-320px)] min-h-[420px] pt-1">
                    <TaskListView
                        columns={visibleColumns}
                        onTaskClick={handleTaskClick}
                        visibleColumns={visibleListColumns}
                        columnWidths={listColumnWidths}
                        onResizeStart={handleListColumnResizeStart}
                        isAddingTask={isListAddingTask}
                        onAddingTaskChange={setListAddingTask}
                    />
                </div>
            )}

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

            <SchedulerFlowModal
                isOpen={isSchedulerOpen}
                onOpenChange={setSchedulerOpen}
                tasks={schedulerTasks}
                members={schedulerMembers}
                onConfirm={handleSchedulerConfirm}
            />
        </div>
    )
}
