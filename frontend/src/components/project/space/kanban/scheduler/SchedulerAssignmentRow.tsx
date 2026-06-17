import type { Key } from '@heroui/react'
import {
    Autocomplete,
    EmptyState,
    ListBox,
    SearchField,
    useFilter,
} from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '../../../../../shared/components'
import type { SchedulerAssignment, SchedulerMemberOption, SchedulerTaskOption } from './types'

interface SchedulerAssignmentRowProps {
    assignment: SchedulerAssignment
    task: SchedulerTaskOption
    members: SchedulerMemberOption[]
    onChange: (taskId: string, userId: string) => void
}

export function SchedulerAssignmentRow({
    assignment,
    task,
    members,
    onChange,
}: SchedulerAssignmentRowProps) {
    const { t } = useTranslation('space')
    const { contains } = useFilter({ sensitivity: 'base' })
    const selectedMember = members.find(
        (member) => member.id === assignment.userId,
    )
    const items = members.map((member) => ({
        id: member.id,
        label: member.name,
        avatarUrl: member.avatarUrl,
        color: member.color,
    }))

    function handleChange(key: Key | null) {
        if (!key) return
        onChange(task.id, key as string)
    }

    return (
        <div className="border-default-200 bg-content1 flex items-center justify-between gap-4 rounded-xl border p-3">
            <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-semibold">
                    {task.title}
                </p>
                <p className="text-default-700 mt-1 text-xs font-medium">
                    {task.statusLabel}
                </p>
            </div>

            <Autocomplete
                fullWidth
                aria-label={t('tasks.scheduler.assignment.ariaLabel', {
                    taskTitle: task.title,
                })}
                className="w-full max-w-52"
                placeholder={t('tasks.scheduler.assignment.placeholder')}
                variant="secondary"
                selectionMode="single"
                selectedKey={assignment.userId}
                onSelectionChange={handleChange}
            >
                <Autocomplete.Trigger>
                    <Autocomplete.Value>
                        {({ defaultChildren, isPlaceholder, state }) => {
                            if (isPlaceholder || !state.selectedItems.length) {
                                return (
                                    <span className="text-muted">
                                        {t('tasks.scheduler.assignment.empty')}
                                    </span>
                                )
                            }

                            if (!selectedMember) {
                                return defaultChildren
                            }

                            return (
                                <div className="flex items-center gap-2">
                                    <UserAvatar
                                        className="h-7 w-7 text-xs"
                                        name={selectedMember.name}
                                        src={selectedMember.avatarUrl}
                                        fallbackStyle={{
                                            backgroundColor:
                                                selectedMember.color ??
                                                'var(--color-accent)',
                                        }}
                                    />
                                    <span className="truncate text-sm">
                                        {selectedMember.name}
                                    </span>
                                </div>
                            )
                        }}
                    </Autocomplete.Value>
                    <Autocomplete.ClearButton />
                    <Autocomplete.Indicator />
                </Autocomplete.Trigger>
                <Autocomplete.Popover>
                    <Autocomplete.Filter filter={contains}>
                        <SearchField
                            autoFocus
                            name={`scheduler-assignee-search-${task.id}`}
                            variant="secondary"
                            aria-label={t('tasks.scheduler.assignment.search')}
                        >
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input
                                    placeholder={t(
                                        'tasks.scheduler.assignment.search',
                                    )}
                                />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>

                        <ListBox
                            renderEmptyState={() => (
                                <EmptyState>
                                    {t('tasks.scheduler.assignment.empty')}
                                </EmptyState>
                            )}
                        >
                            {items.map((item) => (
                                <ListBox.Item
                                    key={item.id}
                                    id={item.id}
                                    textValue={item.label}
                                >
                                    <div className="flex items-center gap-2">
                                        <UserAvatar
                                            className="h-7 w-7 text-xs"
                                            name={item.label}
                                            src={item.avatarUrl}
                                            fallbackStyle={{
                                                backgroundColor:
                                                    item.color ??
                                                    'var(--color-accent)',
                                            }}
                                        />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm">
                                            {item.label}
                                        </p>
                                    </div>
                                </div>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                            ))}
                        </ListBox>
                    </Autocomplete.Filter>
                </Autocomplete.Popover>
            </Autocomplete>
        </div>
    )
}
