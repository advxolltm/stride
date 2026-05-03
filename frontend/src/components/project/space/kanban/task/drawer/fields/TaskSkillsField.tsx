import type { Key } from '@heroui/react'
import {
    Autocomplete,
    EmptyState,
    Label,
    ListBox,
    SearchField,
    Spinner,
    Tag,
    TagGroup,
    toast,
    useFilter,
} from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useUpdateTaskMutation } from '../../../../../../../store/features/tasks/task.api'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../../../context/useTaskBoard'

export function TaskSkillsField({ task }: { task: Task }) {
    const { t } = useTranslation('space')
    const { skills, projectId } = useTaskBoard()
    const [updateTask, { isLoading: isSaving }] = useUpdateTaskMutation()
    const { contains } = useFilter({ sensitivity: 'base' })

    const selectedKeys = (
        (task as Task & { skills?: { id: string }[] }).skills ?? []
    ).map((skill: { id: string }) => skill.id)

    async function handleChange(keys: Key[]) {
        await updateTask({
            taskId: task.id,
            projectId,
            body: { skill_ids: keys as string[] },
        }).unwrap()
        toast.success(t('tasks.messages.taskUpdateSuccess'))
    }

    async function handleRemove(keys: Set<Key>) {
        const next = selectedKeys.filter((id: string) => !keys.has(id))
        await updateTask({
            taskId: task.id,
            projectId,
            body: { skill_ids: next },
        }).unwrap()
        toast.success(t('tasks.messages.taskUpdateSuccess'))
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <Label>{t('tasks.form.skills')}</Label>
                {isSaving && <Spinner color="current" size="sm" />}
            </div>

            <Autocomplete
                variant="secondary"
                className="w-full"
                placeholder={t('tasks.form.skillsPlaceholder')}
                selectionMode="multiple"
                value={selectedKeys}
                isDisabled={isSaving}
                onChange={(keys) => handleChange(keys as Key[])}
            >
                <Autocomplete.Trigger className="w-full">
                    <Autocomplete.Value>
                        {({ defaultChildren, isPlaceholder, state }) => {
                            if (
                                isPlaceholder ||
                                state.selectedItems.length === 0
                            ) {
                                return defaultChildren
                            }
                            return (
                                <TagGroup size="sm" onRemove={handleRemove}>
                                    <TagGroup.List>
                                        {state.selectedItems.map((item) => (
                                            <Tag
                                                key={item.key}
                                                id={item.key as string}
                                            >
                                                {
                                                    skills.find(
                                                        (s) =>
                                                            s.id === item.key,
                                                    )?.name
                                                }
                                            </Tag>
                                        ))}
                                    </TagGroup.List>
                                </TagGroup>
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
                            className="w-full"
                        >
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input
                                    placeholder={t('tasks.form.skillsSearch')}
                                />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>
                        <ListBox
                            renderEmptyState={() => (
                                <EmptyState>
                                    {t('tasks.form.skillsEmpty')}
                                </EmptyState>
                            )}
                        >
                            {skills.map((skill) => (
                                <ListBox.Item
                                    key={skill.id}
                                    id={skill.id}
                                    textValue={skill.name}
                                >
                                    {skill.name}
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
