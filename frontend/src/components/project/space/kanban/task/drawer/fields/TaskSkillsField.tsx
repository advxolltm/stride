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
    useFilter,
} from '@heroui/react'
import { useTranslation } from 'react-i18next'
import {
    useAddSkillToTaskMutation,
    useRemoveSkillFromTaskMutation,
} from '../../../../../../../store/features/tasks/task.api'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../../../context/useTaskBoard'

export function TaskSkillsField({ task }: { task: Task }) {
    const { t } = useTranslation('space')
    const { skills, projectId } = useTaskBoard()
    const [addSkill, { isLoading: isAdding }] = useAddSkillToTaskMutation()
    const [removeSkill, { isLoading: isRemoving }] =
        useRemoveSkillFromTaskMutation()
    const { contains } = useFilter({ sensitivity: 'base' })

    const selectedKeys = (task.skills ?? []).map(
        (skill) => skill.projectSkillId,
    )

    async function handleChange(keys: Key[]) {
        const incoming = keys as string[]
        const toAdd = incoming.filter((id) => !selectedKeys.includes(id))
        const toRemove = selectedKeys.filter((id) => !incoming.includes(id))

        for (const skillId of toAdd) {
            await addSkill({ taskId: task.id, projectId, skillId })
        }
        for (const skillId of toRemove) {
            await removeSkill({ taskId: task.id, projectId, skillId })
        }
    }

    async function handleRemove(keys: Set<Key>) {
        for (const skillId of keys) {
            await removeSkill({
                taskId: task.id,
                projectId,
                skillId: skillId as string,
            })
        }
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <Label>{t('tasks.form.skills')}</Label>
                {isAdding || isRemoving ? (
                    <Spinner color="current" size="sm" />
                ) : null}
            </div>

            <Autocomplete
                fullWidth
                variant="secondary"
                allowsEmptyCollection
                placeholder={t('tasks.form.skillsPlaceholder')}
                selectionMode="multiple"
                value={selectedKeys}
                isDisabled={isAdding || isRemoving}
                onChange={(keys) => handleChange(keys as Key[])}
                aria-label={t('tasks.form.skills')}
            >
                <Autocomplete.Trigger>
                    <Autocomplete.Value>
                        {({ defaultChildren, isPlaceholder, state }) => {
                            if (
                                isPlaceholder ||
                                state.selectedItems.length === 0
                            ) {
                                return defaultChildren
                            }
                            return (
                                <TagGroup
                                    aria-label={t('tasks.form.skills')}
                                    selectionMode="none"
                                    onRemove={handleRemove}
                                    variant="surface"
                                >
                                    <TagGroup.List
                                        items={state.selectedItems.map(
                                            (item) => ({
                                                id: item.key as string,
                                                name:
                                                    skills.find(
                                                        (s) =>
                                                            s.id === item.key,
                                                    )?.name ?? '',
                                            }),
                                        )}
                                        renderEmptyState={() => null}
                                    >
                                        {(item) => (
                                            <Tag key={item.id} id={item.id}>
                                                {item.name}
                                                <Tag.RemoveButton />
                                            </Tag>
                                        )}
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
                            aria-label={t('tasks.form.skillsSearch')}
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
