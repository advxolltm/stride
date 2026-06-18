import type {
    ColumnWidthMap,
    ListColumnId,
    OptionalColumnId,
} from './taskList.config'
import {
    DEFAULT_TASK_LIST_COLUMN_WIDTHS,
    TASK_LIST_COLUMN_MAX_WIDTHS,
    TASK_LIST_COLUMN_MIN_WIDTHS,
    TASK_LIST_COLUMN_ORDER,
} from './taskList.config'

export interface TaskListProjectPreferences {
    visibleColumns?: OptionalColumnId[]
    columnWidths?: Partial<ColumnWidthMap>
}

export type TaskListPreferencesMap = Record<string, TaskListProjectPreferences>

const TASK_LIST_COLUMN_GAP = 16
const TASK_LIST_ROW_HORIZONTAL_PADDING = 40

export function normalizeVisibleListColumns(
    visibleColumns?: OptionalColumnId[],
): OptionalColumnId[] {
    if (!visibleColumns || visibleColumns.length === 0) {
        return [...TASK_LIST_COLUMN_ORDER]
    }

    const savedColumns = new Set(visibleColumns ?? [])
    savedColumns.add('description')

    const normalized = TASK_LIST_COLUMN_ORDER.filter((columnId) =>
        savedColumns.has(columnId),
    )

    return normalized.length > 0 ? normalized : [...TASK_LIST_COLUMN_ORDER]
}

export function createTaskListColumnWidths(
    columnWidths?: Partial<ColumnWidthMap>,
): ColumnWidthMap {
    return {
        ...DEFAULT_TASK_LIST_COLUMN_WIDTHS,
        ...columnWidths,
    }
}

export function getActiveTaskListColumns(
    visibleColumns: OptionalColumnId[],
): OptionalColumnId[] {
    return TASK_LIST_COLUMN_ORDER.filter((columnId) =>
        visibleColumns.includes(columnId),
    )
}

export function getTaskListGridTemplateColumns(
    activeColumns: OptionalColumnId[],
    columnWidths: ColumnWidthMap,
): string {
    const optionalParts = activeColumns.map(
        (columnId) => `${columnWidths[columnId]}px`,
    )

    return [`${columnWidths.task}px`, ...optionalParts].join(' ')
}

export function getTaskListTableWidth(
    activeColumns: OptionalColumnId[],
    columnWidths: ColumnWidthMap,
): number {
    const columnCount = 1 + activeColumns.length
    const contentWidth =
        columnWidths.task +
        activeColumns.reduce(
            (total, columnId) => total + columnWidths[columnId],
            0,
        )

    const gridGapWidth = Math.max(0, columnCount - 1) * TASK_LIST_COLUMN_GAP

    return contentWidth + gridGapWidth + TASK_LIST_ROW_HORIZONTAL_PADDING
}

export function toggleTaskListColumn(
    current: OptionalColumnId[],
    columnId: OptionalColumnId,
): OptionalColumnId[] {
    if (current.includes(columnId)) {
        const next = current.filter((item) => item !== columnId)
        return next.length > 0 ? next : current
    }

    return TASK_LIST_COLUMN_ORDER.filter((item) =>
        [...current, columnId].includes(item),
    )
}

export function clampTaskListColumnWidth(
    columnId: ListColumnId,
    width: number,
): number {
    return Math.max(
        TASK_LIST_COLUMN_MIN_WIDTHS[columnId],
        Math.min(TASK_LIST_COLUMN_MAX_WIDTHS[columnId], width),
    )
}

export function readTaskListProjectPreferences(
    rawValue: string | null,
    projectId: string,
): TaskListProjectPreferences {
    if (!rawValue) {
        return {}
    }

    try {
        const parsed = JSON.parse(rawValue) as TaskListPreferencesMap
        return parsed[projectId] ?? {}
    } catch {
        return {}
    }
}
