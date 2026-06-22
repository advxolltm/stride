import { Button } from '@heroui/react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
    TaskAssignee,
    TaskSkill,
} from '../../../../../store/features/tasks/task.types'
import { FilterAutocomplete } from './FilterAutocomplete'

interface TaskFiltersProps {
    showStatusFilter?: boolean
    statusOptions: { id: string; label: string }[]
    uniqueAssignees: TaskAssignee[]
    uniqueSkills: TaskSkill[]
    selectedStatuses: Set<string>
    selectedAssigneeIds: Set<string>
    selectedSkillIds: Set<string>
    hasActiveFilters: boolean
    onStatusFilterChange: (keys: Set<string>) => void
    onAssigneeFilterChange: (keys: Set<string>) => void
    onSkillFilterChange: (keys: Set<string>) => void
    onClearAllFilters: () => void
}

export function TaskFilters({
    showStatusFilter = true,
    statusOptions,
    uniqueAssignees,
    uniqueSkills,
    selectedStatuses,
    selectedAssigneeIds,
    selectedSkillIds,
    hasActiveFilters,
    onStatusFilterChange,
    onAssigneeFilterChange,
    onSkillFilterChange,
    onClearAllFilters,
}: TaskFiltersProps) {
    const { t } = useTranslation('space')

    const assigneeOptions = uniqueAssignees.map((a) => ({
        id: a.user.id,
        label: a.user.fullName ?? a.user.username,
    }))

    const skillOptions = uniqueSkills.map((s) => ({
        id: s.id,
        label: s.name,
    }))

    return (
        <>
            {showStatusFilter && (
                <FilterAutocomplete
                    label={t('tasks.list.filter.status')}
                    searchPlaceholder={t('tasks.list.filter.status')}
                    emptyMessage={t('tasks.list.filter.status')}
                    options={statusOptions}
                    selectedKeys={selectedStatuses}
                    onSelectionChange={onStatusFilterChange}
                />
            )}
            <FilterAutocomplete
                label={t('tasks.list.filter.assignee')}
                searchPlaceholder={t('tasks.list.filter.assignee')}
                emptyMessage={t('tasks.list.filter.emptyAssignee')}
                options={assigneeOptions}
                selectedKeys={selectedAssigneeIds}
                onSelectionChange={onAssigneeFilterChange}
            />
            <FilterAutocomplete
                label={t('tasks.list.filter.skill')}
                searchPlaceholder={t('tasks.list.filter.skill')}
                emptyMessage={t('tasks.list.filter.emptySkill')}
                options={skillOptions}
                selectedKeys={selectedSkillIds}
                onSelectionChange={onSkillFilterChange}
            />
            {hasActiveFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onPress={onClearAllFilters}
                >
                    <X size={14} />
                    {t('tasks.list.filter.clear')}
                </Button>
            )}
        </>
    )
}
