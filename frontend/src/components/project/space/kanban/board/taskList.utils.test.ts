import { describe, expect, it } from 'vitest'
import { DEFAULT_TASK_LIST_COLUMN_WIDTHS } from './taskList.config'
import {
    clampTaskListColumnWidth,
    createTaskListColumnWidths,
    getActiveTaskListColumns,
    getTaskListGridTemplateColumns,
    getTaskListTableWidth,
    normalizeVisibleListColumns,
    readTaskListProjectPreferences,
    toggleTaskListColumn,
} from './taskList.utils'

describe('taskList utils', () => {
    it('keeps description visible when stored columns omit it', () => {
        expect(normalizeVisibleListColumns(['status'])).toEqual([
            'description',
            'status',
        ])
    })

    it('falls back to all columns when no stored selection exists', () => {
        expect(normalizeVisibleListColumns()).toEqual([
            'description',
            'skills',
            'assignee',
            'status',
            'estimatedTime',
            'startDate',
            'dueDate',
        ])
    })

    it('merges stored widths with defaults', () => {
        expect(createTaskListColumnWidths({ task: 400, dueDate: 200 })).toEqual(
            {
                ...DEFAULT_TASK_LIST_COLUMN_WIDTHS,
                task: 400,
                dueDate: 200,
            },
        )
    })

    it('returns visible columns in canonical order', () => {
        expect(getActiveTaskListColumns(['dueDate', 'status'])).toEqual([
            'status',
            'dueDate',
        ])
    })

    it('builds the grid template string from widths', () => {
        expect(
            getTaskListGridTemplateColumns(
                ['status', 'dueDate'],
                DEFAULT_TASK_LIST_COLUMN_WIDTHS,
            ),
        ).toBe('320px 140px 140px')
    })

    it('includes column gaps and row padding in total table width', () => {
        expect(
            getTaskListTableWidth(
                ['status', 'dueDate'],
                DEFAULT_TASK_LIST_COLUMN_WIDTHS,
            ),
        ).toBe(320 + 140 + 140 + 2 * 16 + 40)
    })

    it('preserves at least one column when toggling off the last visible one', () => {
        expect(toggleTaskListColumn(['status'], 'status')).toEqual(['status'])
    })

    it('adds a column back in canonical order when toggled on', () => {
        expect(toggleTaskListColumn(['description', 'dueDate'], 'status')).toEqual(
            ['description', 'status', 'dueDate'],
        )
    })

    it('clamps resized widths to the configured limits', () => {
        expect(clampTaskListColumnWidth('status', 10)).toBe(120)
        expect(clampTaskListColumnWidth('status', 500)).toBe(240)
    })

    it('reads project-specific preferences safely from localStorage JSON', () => {
        expect(
            readTaskListProjectPreferences(
                JSON.stringify({
                    alpha: { visibleColumns: ['status'] },
                    beta: { visibleColumns: ['dueDate'] },
                }),
                'beta',
            ),
        ).toEqual({ visibleColumns: ['dueDate'] })
    })

    it('returns empty preferences for invalid localStorage JSON', () => {
        expect(readTaskListProjectPreferences('{broken', 'alpha')).toEqual({})
    })
})
