import type { Key } from '@heroui/react'
import {
    Autocomplete,
    Avatar,
    EmptyState,
    Label,
    ListBox,
    SearchField,
    Spinner,
    useFilter,
} from '@heroui/react'
import { useTranslation } from 'react-i18next'
import getInitials from '../../../../../../../shared/utils/getInitials'
import {
    useAssignTaskMutation,
    useUnassignTaskMutation,
} from '../../../../../../../store/features/tasks/task.api'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../../../context/useTaskBoard'

export function TaskAssigneeField({ task }: { task: Task }) {
    const { t } = useTranslation('space')
    const { projectId, members } = useTaskBoard()
    const { contains } = useFilter({ sensitivity: 'base' })

    const [assignTask, { isLoading: isAssigning }] = useAssignTaskMutation()
    const [unassignTask, { isLoading: isRemovingAssignee }] =
        useUnassignTaskMutation()

    const isSaving = isAssigning || isRemovingAssignee

    const currentAssignee = task.assignees?.[0]
    const selectedKey = currentAssignee?.projectMemberId ?? null

    const items = members.map((m) => ({
        id: m.id,
        label: m.user.fullName ?? m.user.username,
    }))

    async function handleChange(key: Key | null) {
        if (!key) {
            if (!currentAssignee) return
            await unassignTask({
                taskId: task.id,
                projectId,
                body: { project_member_id: currentAssignee.projectMemberId },
            })
            return
        }

        // A member was selected — unassign current first if any, then assign new
        if (currentAssignee) {
            await unassignTask({
                taskId: task.id,
                projectId,
                body: { project_member_id: currentAssignee.projectMemberId },
            })
        }
        await assignTask({
            taskId: task.id,
            projectId,
            body: { project_member_id: key as string },
        })
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <Label>{t('tasks.form.assignee')}</Label>
                {isSaving && <Spinner color="current" size="sm" />}
            </div>

            <Autocomplete
                fullWidth
                variant="secondary"
                placeholder={t('tasks.form.assigneeEmpty')}
                selectionMode="single"
                value={selectedKey}
                isDisabled={isSaving}
                onChange={handleChange}
                aria-label={t('tasks.form.assignee')}
            >
                <Autocomplete.Trigger>
                    <Autocomplete.Value>
                        {({ defaultChildren, isPlaceholder, state }) => {
                            if (isPlaceholder || !state.selectedItems.length) {
                                return (
                                    <span className="text-muted">
                                        {t('tasks.form.assigneeEmpty')}
                                    </span>
                                )
                            }

                            const selected = state.selectedItems[0]
                            const member = members.find(
                                (m) => m.id === selected.key,
                            )
                            if (!member) return defaultChildren

                            return (
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6 text-xs">
                                        <Avatar.Fallback className="bg-accent text-white">
                                            {getInitials(
                                                member.user.fullName ??
                                                    member.user.username,
                                            )}
                                        </Avatar.Fallback>
                                    </Avatar>
                                    <span>
                                        {member.user.fullName ??
                                            member.user.username}
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
                            name="search"
                            variant="secondary"
                            aria-label={t('tasks.form.assigneeSearch')}
                        >
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input
                                    placeholder={t('tasks.form.assigneeSearch')}
                                />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>

                        <ListBox
                            renderEmptyState={() => (
                                <EmptyState>
                                    {t('tasks.form.assigneeEmpty')}
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
                                        <Avatar className="h-6 w-6 text-xs">
                                            <Avatar.Fallback className="bg-accent text-white">
                                                {getInitials(item.label)}
                                            </Avatar.Fallback>
                                        </Avatar>
                                        <span className="text-sm">
                                            {item.label}
                                        </span>
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
