import { useEffect, useMemo, useState } from 'react'
import type {
    ColumnWidthMap,
    OptionalColumnId,
} from './taskList.config'
import {
    clampTaskListColumnWidth,
    createTaskListColumnWidths,
    normalizeVisibleListColumns,
    type TaskListPreferencesMap,
    toggleTaskListColumn,
} from './taskList.utils'

const TASK_LIST_PREFERENCES_STORAGE_KEY = 'task-list-preferences'

export function useTaskListPreferences(projectId: string) {
    const [preferencesMap, setPreferencesMap] = useState<TaskListPreferencesMap>(
        () => {
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
                return JSON.parse(rawValue) as TaskListPreferencesMap
            } catch {
                return {}
            }
        },
    )

    const currentProjectPreferences = useMemo(() => {
        return preferencesMap[projectId] ?? {}
    }, [preferencesMap, projectId])

    const visibleListColumns = useMemo(() => {
        return normalizeVisibleListColumns(
            currentProjectPreferences.visibleColumns,
        )
    }, [currentProjectPreferences.visibleColumns])

    const listColumnWidths = useMemo(() => {
        return createTaskListColumnWidths(currentProjectPreferences.columnWidths)
    }, [currentProjectPreferences.columnWidths])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        window.localStorage.setItem(
            TASK_LIST_PREFERENCES_STORAGE_KEY,
            JSON.stringify(preferencesMap),
        )
    }, [preferencesMap])

    function toggleColumn(columnId: OptionalColumnId) {
        setPreferencesMap((current) => {
            const projectPreferences = current[projectId] ?? {}

            return {
                ...current,
                [projectId]: {
                    ...projectPreferences,
                    visibleColumns: toggleTaskListColumn(
                        normalizeVisibleListColumns(
                            projectPreferences.visibleColumns,
                        ),
                        columnId,
                    ),
                },
            }
        })
    }

    function updateColumnWidth(columnId: keyof ColumnWidthMap, width: number) {
        setPreferencesMap((current) => {
            const projectPreferences = current[projectId] ?? {}
            const currentWidths = createTaskListColumnWidths(
                projectPreferences.columnWidths,
            )

            return {
                ...current,
                [projectId]: {
                    ...projectPreferences,
                    columnWidths: {
                        ...currentWidths,
                        [columnId]: clampTaskListColumnWidth(columnId, width),
                    },
                },
            }
        })
    }

    return {
        visibleListColumns,
        listColumnWidths,
        toggleColumn,
        updateColumnWidth,
    }
}
