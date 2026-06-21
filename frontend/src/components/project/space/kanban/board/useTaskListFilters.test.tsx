// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Task } from '../../../../../store/features/tasks/task.types'
import { useTaskListFilters } from './useTaskListFilters'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: `task-${Math.random().toString(36).slice(2, 8)}`,
        projectId: 'project-1',
        createdBy: 'user-1',
        title: 'Test task',
        description: null,
        status: 'todo',
        startDate: null,
        dueDate: null,
        expectedDurationHours: null,
        position: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
        assignees: [],
        skills: [],
        ...overrides,
    }
}

function Harness({ tasks }: { tasks: Task[] }) {
    const filters = useTaskListFilters(tasks)

    return (
        <div>
            <span data-testid="filter-count">
                {filters.filteredTasks.length}
            </span>
            <span data-testid="has-active">
                {String(filters.hasActiveFilters)}
            </span>
            <span data-testid="unique-assignee-count">
                {filters.uniqueAssignees.length}
            </span>
            <span data-testid="unique-skill-count">
                {filters.uniqueSkills.length}
            </span>
            <button
                data-testid="set-status-todo"
                onClick={() =>
                    filters.handleStatusFilterChange(new Set(['todo']))
                }
            />
            <button
                data-testid="set-status-all"
                onClick={() =>
                    filters.handleStatusFilterChange(
                        new Set(['todo', 'in_progress', 'done']),
                    )
                }
            />
            <button
                data-testid="set-assignee-user-1"
                onClick={() =>
                    filters.handleAssigneeFilterChange(new Set(['user-1']))
                }
            />
            <button
                data-testid="set-skill-skill-1"
                onClick={() =>
                    filters.handleSkillFilterChange(new Set(['skill-1']))
                }
            />
            <button
                data-testid="clear-filters"
                onClick={() => filters.clearAllFilters()}
            />
        </div>
    )
}

describe('useTaskListFilters', () => {
    let container: HTMLDivElement
    let root: Root

    const renderHarness = (tasks: Task[]) => {
        act(() => {
            root.render(<Harness tasks={tasks} />)
        })
    }

    const getText = (testId: string) => {
        const element = container.querySelector(`[data-testid="${testId}"]`)
        if (!element) throw new Error(`Element [data-testid="${testId}"] not found`)
        return element.textContent ?? ''
    }

    const click = (testId: string) => {
        const button = container.querySelector(
            `[data-testid="${testId}"]`,
        ) as HTMLButtonElement | null
        if (!button) throw new Error(`Button [data-testid="${testId}"] not found`)
        act(() => button.click())
    }

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
        root = createRoot(container)
    })

    afterEach(() => {
        act(() => root.unmount())
        container.remove()
        document.body.innerHTML = ''
    })

    it('returns all tasks when no filters are active', () => {
        const tasks = [
            makeTask({ status: 'todo' }),
            makeTask({ status: 'in_progress' }),
            makeTask({ status: 'done' }),
        ]

        renderHarness(tasks)

        expect(Number(getText('filter-count'))).toBe(3)
        expect(getText('has-active')).toBe('false')
    })

    it('filters by a single status', () => {
        const tasks = [
            makeTask({ id: 't1', status: 'todo' }),
            makeTask({ id: 't2', status: 'in_progress' }),
            makeTask({ id: 't3', status: 'done' }),
        ]

        renderHarness(tasks)
        click('set-status-todo')

        expect(Number(getText('filter-count'))).toBe(1)
        expect(getText('has-active')).toBe('true')
    })

    it('filters by multiple statuses', () => {
        const tasks = [
            makeTask({ status: 'todo' }),
            makeTask({ status: 'in_progress' }),
            makeTask({ status: 'done' }),
        ]

        renderHarness(tasks)
        click('set-status-all')

        expect(Number(getText('filter-count'))).toBe(3)
        expect(getText('has-active')).toBe('true')
    })

    it('filters by assignee', () => {
        const tasks = [
            makeTask({
                id: 't1',
                assignees: [
                    {
                        id: 'a1',
                        taskId: 't1',
                        projectMemberId: 'pm1',
                        assignedAt: '',
                        user: {
                            id: 'user-1',
                            username: 'alice',
                            email: 'alice@example.com',
                            fullName: 'Alice',
                            avatarUrl: null,
                            isSuperuser: false,
                        },
                    },
                ],
            }),
            makeTask({ id: 't2', assignees: [] }),
        ]

        renderHarness(tasks)
        click('set-assignee-user-1')

        expect(Number(getText('filter-count'))).toBe(1)
        expect(getText('has-active')).toBe('true')
    })

    it('filters by skill', () => {
        const tasks = [
            makeTask({
                id: 't1',
                skills: [
                    {
                        id: 'skill-1',
                        taskId: 't1',
                        projectSkillId: 'ps1',
                        name: 'React',
                        description: null,
                    },
                ],
            }),
            makeTask({ id: 't2', skills: [] }),
        ]

        renderHarness(tasks)
        click('set-skill-skill-1')

        expect(Number(getText('filter-count'))).toBe(1)
        expect(getText('has-active')).toBe('true')
    })

    it('combines filters with AND logic', () => {
        const matchingTask = makeTask({
            id: 't1',
            status: 'todo',
            assignees: [
                {
                    id: 'a1',
                    taskId: 't1',
                    projectMemberId: 'pm1',
                    assignedAt: '',
                    user: {
                        id: 'user-1',
                        username: 'alice',
                        email: '',
                        fullName: null,
                        avatarUrl: null,
                        isSuperuser: false,
                    },
                },
            ],
            skills: [
                {
                    id: 'skill-1',
                    taskId: 't1',
                    projectSkillId: 'ps1',
                    name: 'React',
                    description: null,
                },
            ],
        })
        const onlyCorrectStatus = makeTask({
            id: 't2',
            status: 'todo',
            assignees: [],
            skills: [],
        })

        renderHarness([matchingTask, onlyCorrectStatus])
        click('set-status-todo')
        click('set-assignee-user-1')
        click('set-skill-skill-1')

        expect(Number(getText('filter-count'))).toBe(1)
    })

    it('returns zero tasks when no task matches filters', () => {
        const tasks = [makeTask({ id: 't1', status: 'todo' })]

        renderHarness(tasks)
        click('set-assignee-user-1')

        expect(Number(getText('filter-count'))).toBe(0)
    })

    it('clearAllFilters resets all filter selections', () => {
        const tasks = [
            makeTask({ status: 'todo' }),
            makeTask({ status: 'in_progress' }),
        ]

        renderHarness(tasks)
        click('set-status-todo')

        expect(Number(getText('filter-count'))).toBe(1)

        click('clear-filters')

        expect(Number(getText('filter-count'))).toBe(2)
        expect(getText('has-active')).toBe('false')
    })

    it('deduplicates assignees across multiple tasks', () => {
        const user = {
            id: 'user-1',
            username: 'alice',
            email: '',
            fullName: null,
            avatarUrl: null,
            isSuperuser: false,
        } as const
        const tasks = [
            makeTask({
                assignees: [
                    {
                        id: 'a1',
                        taskId: '',
                        projectMemberId: 'pm1',
                        assignedAt: '',
                        user,
                    },
                ],
            }),
            makeTask({
                assignees: [
                    {
                        id: 'a2',
                        taskId: '',
                        projectMemberId: 'pm1',
                        assignedAt: '',
                        user,
                    },
                ],
            }),
        ]

        renderHarness(tasks)

        expect(Number(getText('unique-assignee-count'))).toBe(1)
    })

    it('deduplicates skills across multiple tasks', () => {
        const tasks = [
            makeTask({
                skills: [
                    {
                        id: 'skill-1',
                        taskId: '',
                        projectSkillId: 'ps1',
                        name: 'React',
                        description: null,
                    },
                ],
            }),
            makeTask({
                skills: [
                    {
                        id: 'skill-1',
                        taskId: '',
                        projectSkillId: 'ps1',
                        name: 'React',
                        description: null,
                    },
                ],
            }),
        ]

        renderHarness(tasks)

        expect(Number(getText('unique-skill-count'))).toBe(1)
    })

    it('handles tasks with undefined assignees and skills', () => {
        const tasks = [makeTask({ assignees: undefined, skills: undefined })]

        renderHarness(tasks)

        expect(Number(getText('filter-count'))).toBe(1)
        expect(Number(getText('unique-assignee-count'))).toBe(0)
        expect(Number(getText('unique-skill-count'))).toBe(0)
    })

    it('returns all tasks when filter set is empty (edge case after clear)', () => {
        const tasks = [
            makeTask({ status: 'todo' }),
            makeTask({ status: 'in_progress' }),
        ]

        renderHarness(tasks)
        click('set-status-todo')
        click('clear-filters')

        expect(Number(getText('filter-count'))).toBe(2)
    })
})
