import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { Button, Dropdown, SearchField, Tabs, toast } from '@heroui/react'
import {
    Check,
    LayoutGrid,
    List,
    ListPlus,
    SlidersHorizontal,
    UserPlus,
} from 'lucide-react'
import { type MouseEvent as ReactMouseEvent, useMemo, useState } from 'react'
import useMediaQuery from '../../../../../shared/hooks/useMediaQuery'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../../../shared/components'
import { getApiErrorMessage } from '../../../../../shared/utils/api/errors'
import {
    useConfirmScheduledAssignmentsMutation,
    useScheduleProjectTasksMutation,
} from '../../../../../store/features/project/project.api'
import type { Task } from '../../../../../store/features/tasks/task.types'
import { ArchivedReadOnlyChip } from '../../shared/ArchivedReadOnlyChip'
import { useTaskBoard } from '../context/useTaskBoard'
import { SchedulerFlowModal } from '../scheduler/SchedulerFlowModal'
import {
    buildSchedulerTriggerRequest,
    mapProjectMemberToSchedulerMemberOption,
    mapTaskToSchedulerTaskOption,
} from '../scheduler/scheduler.mappers'
import type {
    SchedulerMemberOption,
    SchedulerPreviewResponse,
    SchedulerTaskOption,
} from '../scheduler/types'
import { TaskEditDrawer } from '../task/drawer/TaskEditDrawer'
import { KanbanCard } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import { type ListColumnId, TASK_LIST_COLUMN_ORDER } from './taskList.config'
import { TaskCardList } from './TaskCardList'
import { TaskListView } from './TaskListView'
import { clampTaskListColumnWidth } from './taskList.utils'
import { useTaskListFilters } from './useTaskListFilters'
import { useTaskListPreferences } from './useTaskListPreferences'
import { useKanbanState } from './useKanbanState'
import type { OptimizationStrategy } from '../scheduler/SchedulerFlowModal'
import { TaskFilters } from './TaskFilters'

function taskMatchesSearch(task: Task, query: string) {
    const searchableText = [
        task.title,
        task.description,
        ...(task.assignees ?? []).flatMap((assignee) => [
            assignee.user.fullName,
            assignee.user.username,
            assignee.user.email,
        ]),
        ...(task.skills ?? []).flatMap((skill) => [
            skill.name,
            skill.description,
        ]),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

    return searchableText.includes(query)
}

const EMPTY_SCHEDULER_PREVIEW: SchedulerPreviewResponse = {
    newAssignments: [],
    changedAssignments: [],
	incompatibleAssignments: [],
}

export function KanbanBoard() {
    const { t } = useTranslation('space')
    const { isLoading, isArchived, members, skills, projectId, statusOptions } =
        useTaskBoard()
    const [taskSearch, setTaskSearch] = useState('')
    const [isSchedulerOpen, setSchedulerOpen] = useState(false)
    const [isListAddingTask, setListAddingTask] = useState(false)
    const [scheduleProjectTasks] = useScheduleProjectTasksMutation()
    const [confirmScheduledAssignments] =
        useConfirmScheduledAssignmentsMutation()
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
    const {
        visibleListColumns,
        listColumnWidths,
        toggleColumn: toggleListColumn,
        updateColumnWidth,
    } = useTaskListPreferences(projectId)
    const isLG = useMediaQuery('(max-width: 1024px)')
    const isXlOrLess = useMediaQuery('(max-width: 1279px)')
    const effectiveView = isLG ? 'list' : view

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

    const flatTasks = useMemo(
        () => visibleColumns.flatMap((col) => col.tasks),
        [visibleColumns],
    )

    const {
        selectedStatuses,
        selectedAssigneeIds,
        selectedSkillIds,
        uniqueAssignees,
        uniqueSkills,
        filteredTasks,
        hasActiveFilters,
        clearAllFilters,
        handleStatusFilterChange,
        handleAssigneeFilterChange,
        handleSkillFilterChange,
    } = useTaskListFilters(flatTasks, members, skills)

    const filteredColumns = useMemo(() => {
        if (!hasActiveFilters) return visibleColumns

        const filteredIds = new Set(filteredTasks.map((t) => t.id))
        return visibleColumns.map((col) => ({
            ...col,
            tasks: col.tasks.filter((t) => filteredIds.has(t.id)),
        }))
    }, [visibleColumns, filteredTasks, hasActiveFilters])

    const statusLabelMap = useMemo(
        () =>
            new Map(
                statusOptions.map(
                    (option) => [option.id, option.label] as const,
                ),
            ),
        [statusOptions],
    )

    const flatFilteredTasks = useMemo(
        () => filteredColumns.flatMap((col) => col.tasks),
        [filteredColumns],
    )

    const schedulerTasks = useMemo<SchedulerTaskOption[]>(
        () =>
            localColumns.flatMap((column) =>
                column.tasks
                    .filter((task) => task.status !== 'done')
                    .map((task) =>
                        mapTaskToSchedulerTaskOption(task, statusOptions),
                    ),
            ),
        [localColumns, statusOptions],
    )
    const estimatedSchedulerTaskCount = useMemo(
        () =>
            schedulerTasks.filter(
                (task) => (task.expectedDurationHours ?? 0) > 0,
            ).length,
        [schedulerTasks],
    )
    const startDatedSchedulerTaskCount = useMemo(
        () => schedulerTasks.filter((task) => Boolean(task.startDate)).length,
        [schedulerTasks],
    )

    const schedulerMembers = useMemo<SchedulerMemberOption[]>(
        () => members.map(mapProjectMemberToSchedulerMemberOption),
        [members],
    )
    const schedulableSchedulerMembers = useMemo(
        () => schedulerMembers.filter((member) => member.workingHours > 0),
        [schedulerMembers],
    )
    const skippedSchedulerMemberCount =
        schedulerMembers.length - schedulableSchedulerMembers.length

    async function handleSchedulerRun(strat : OptimizationStrategy, timeout : number) {
        if (schedulerTasks.length === 0) {
            toast.info(t('tasks.scheduler.intro.noTasks'))
            return EMPTY_SCHEDULER_PREVIEW
        }

        if (schedulableSchedulerMembers.length === 0) {
            toast.info(t('tasks.scheduler.intro.noMembers'))
            return EMPTY_SCHEDULER_PREVIEW
        }

        if (estimatedSchedulerTaskCount === 0) {
            toast.info(t('tasks.scheduler.intro.noEstimatedTasks'))
            return EMPTY_SCHEDULER_PREVIEW
        }

        if (startDatedSchedulerTaskCount === 0) {
            toast.info(t('tasks.scheduler.intro.noStartDates'))
            return EMPTY_SCHEDULER_PREVIEW
        }

        timeout = Math.round(timeout)

        if (timeout > 45) {
            timeout = 45
        }
        if (timeout < 3) {
            timeout = 3
        }

        try {
            const response = await scheduleProjectTasks({
                projectId,
                body: buildSchedulerTriggerRequest(
                    schedulerTasks,
                    schedulerMembers,
                    ['max-hours-scheduled', strat as string, 'max-tasks-scheduled'],
                    timeout
                ),
            }).unwrap()

            return response
        } catch (error: unknown) {
            toast.danger(
                getApiErrorMessage(
                    error,
                    t('tasks.scheduler.messages.generateError'),
                ),
            )
            throw error
        }
    }

    async function handleSchedulerConfirm(
        assignments: {
            userId: string | null
            taskId: string
        }[],
    ) {
        try {
            await confirmScheduledAssignments({
                projectId,
                body: assignments.map((assignment) => ({
                    user_id: assignment.userId,
                    task_id: assignment.taskId,
                })),
            }).unwrap()
            toast.success(t('tasks.scheduler.messages.confirmSuccess'))
        } catch (error: unknown) {
            toast.danger(
                getApiErrorMessage(
                    error,
                    t('tasks.scheduler.messages.confirmError'),
                ),
            )
            throw error
        }
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
            const nextWidth = clampTaskListColumnWidth(
                columnId,
                startWidth + (moveEvent.clientX - startX),
            )

            updateColumnWidth(columnId, nextWidth)
        }

        function handlePointerUp() {
            window.removeEventListener('mousemove', handlePointerMove)
            window.removeEventListener('mouseup', handlePointerUp)
        }

        window.addEventListener('mousemove', handlePointerMove)
        window.addEventListener('mouseup', handlePointerUp)
    }

    function renderToolbar(
        showListActions: boolean,
        showStatusFilter: boolean,
        showColumnSelector = true,
    ) {
        return (
            <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                <SearchField
                    name="task-search"
                    value={taskSearch}
                    onChange={setTaskSearch}
                    aria-label={t('tasks.actions.searchTasks')}
                    className="w-full xl:w-80"
                >
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input
                            placeholder={t('tasks.actions.searchTasks')}
                        />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>

                <TaskFilters
                    showStatusFilter={showStatusFilter}
                    statusOptions={statusOptions}
                    uniqueAssignees={uniqueAssignees}
                    uniqueSkills={uniqueSkills}
                    selectedStatuses={selectedStatuses}
                    selectedAssigneeIds={selectedAssigneeIds}
                    selectedSkillIds={selectedSkillIds}
                    hasActiveFilters={hasActiveFilters}
                    onStatusFilterChange={handleStatusFilterChange}
                    onAssigneeFilterChange={handleAssigneeFilterChange}
                    onSkillFilterChange={handleSkillFilterChange}
                    onClearAllFilters={clearAllFilters}
                />

                {showListActions && showColumnSelector && (
                    <Dropdown>
                        <Button variant="secondary" size="sm" className="gap-2">
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
                {!isLG && (
                    <Tabs
                        variant="secondary"
                        className="w-auto flex-none"
                        selectedKey={view}
                        onSelectionChange={(key) =>
                            setView(key as 'kanban' | 'list')
                        }
                    >
                        <Tabs.ListContainer>
                            <Tabs.List aria-label={t('tasks.tabs.ariaLabel')}>
                                <Tabs.Tab
                                    className="flex flex-row gap-2"
                                    id="kanban"
                                >
                                    <LayoutGrid size={16} />
                                    {t('tasks.tabs.board')}
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                                <Tabs.Tab
                                    className="flex flex-row gap-2"
                                    id="list"
                                >
                                    <List size={16} />
                                    {t('tasks.tabs.list')}
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                            </Tabs.List>
                        </Tabs.ListContainer>
                    </Tabs>
                )}

                {renderToolbar(
                    effectiveView === 'list',
                    effectiveView !== 'kanban',
                    !isXlOrLess,
                )}
            </div>

            {effectiveView === 'kanban' ? (
                <div className="pt-1">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="h-[calc(100vh-320px)] min-h-105 overflow-x-auto">
                            <div className="flex h-full min-h-0 gap-6">
                                {filteredColumns.map((col) => (
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
            ) : isXlOrLess ? (
                <div className="h-[calc(100vh-340px)] min-h-105 overflow-y-auto pt-1 sm:h-[calc(100vh-320px)]">
                    <TaskCardList
                        tasks={flatFilteredTasks}
                        columns={visibleColumns}
                        statusLabelMap={statusLabelMap}
                        onTaskClick={handleTaskClick}
                        isAddingTask={isListAddingTask}
                        onAddingTaskChange={setListAddingTask}
                    />
                </div>
            ) : (
                <div className="h-[calc(100vh-340px)] min-h-105 pt-1 sm:h-[calc(100vh-320px)]">
                    <TaskListView
                        columns={filteredColumns}
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
                schedulableMemberCount={schedulableSchedulerMembers.length}
                skippedMemberCount={skippedSchedulerMemberCount}
                estimatedTaskCount={estimatedSchedulerTaskCount}
                startDateTaskCount={startDatedSchedulerTaskCount}
                onRun={handleSchedulerRun}
                onConfirm={handleSchedulerConfirm}
            />
        </div>
    )
}
