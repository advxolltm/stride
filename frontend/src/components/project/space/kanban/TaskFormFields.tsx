import {
    Autocomplete,
    Avatar,
    Chip,
    Input,
    Label,
    ListBox,
    SearchField,
    Select,
    TextArea,
    TextField,
} from '@heroui/react'
import { useMemo } from 'react'
import type { TaskStatus } from './types'
import { useTranslation } from 'react-i18next'

export interface AssigneeOption {
    id: string
    name: string
    initials: string
    color?: string
}

export interface StatusOption {
    id: TaskStatus
    label: string
}

interface TaskFormFieldsProps {
    title: string
    onTitleChange: (value: string) => void
    description: string
    onDescriptionChange: (value: string) => void
    status: TaskStatus
    onStatusChange: (value: TaskStatus) => void
    labels: string[]
    onLabelsChange: (labels: string[]) => void
    assigneeId: string
    onAssigneeChange: (value: string) => void
    assignees: AssigneeOption[]
    labelOptions: string[]
    statusOptions: StatusOption[]
}

export function TaskFormFields({
    title,
    onTitleChange,
    description,
    onDescriptionChange,
    status,
    onStatusChange,
    labels,
    onLabelsChange,
    assigneeId,
    onAssigneeChange,
    assignees,
    labelOptions,
    statusOptions,
}: TaskFormFieldsProps) {
    const { t } = useTranslation('space')

    const selectedStatusLabel = useMemo(() => {
        return statusOptions.find((option) => option.id === status)?.label ?? ''
    }, [status, statusOptions])

    const selectedAssignee = useMemo(() => {
        return assignees.find((option) => option.id === assigneeId)
    }, [assigneeId, assignees])

    const labelItems = useMemo(
        () => labelOptions.map((label) => ({ id: label, label })),
        [labelOptions],
    )

    return (
        <div className="flex flex-col gap-4">
            <TextField className="w-full" name="title">
                <Label>{t('tasks.form.title')}</Label>
                <Input
                    variant="secondary"
                    placeholder={t('tasks.form.titlePlaceholder')}
                    value={title}
                    onChange={(event) => onTitleChange(event.target.value)}
                />
            </TextField>

            <TextField className="w-full" name="description">
                <Label>{t('tasks.form.description')}</Label>
                <TextArea
                    variant="secondary"
                    placeholder={t('tasks.form.descriptionPlaceholder')}
                    value={description}
                    onChange={(event) =>
                        onDescriptionChange(event.target.value)
                    }
                />
            </TextField>

            <Select
                placeholder={t('tasks.form.statusPlaceholder')}
                variant="secondary"
                value={status}
                onChange={(key) => onStatusChange(key as TaskStatus)}
            >
                <Label>{t('tasks.form.status')}</Label>
                <Select.Trigger>
                    <Select.Value>{selectedStatusLabel}</Select.Value>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox items={statusOptions}>
                        {(item) => (
                            <ListBox.Item id={item.id} textValue={item.label}>
                                {item.label}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        )}
                    </ListBox>
                </Select.Popover>
            </Select>

            <Autocomplete
                variant="secondary"
                selectionMode="multiple"
                placeholder={t('tasks.form.labelsPlaceholder')}
                value={labels}
                onChange={
                    (keys) =>
                        onLabelsChange(Array.from(keys as Iterable<string>)) //FIXME: Fix later the skills type
                }
            >
                <Label>{t('tasks.form.labels')}</Label>
                <Autocomplete.Trigger>
                    <Autocomplete.Value />
                    <Autocomplete.ClearButton />
                    <Autocomplete.Indicator />
                </Autocomplete.Trigger>
                <Autocomplete.Popover>
                    <Autocomplete.Filter>
                        <SearchField
                            variant="secondary"
                            aria-label={t('tasks.form.labelsSearch')}
                        >
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input
                                    placeholder={t('tasks.form.labelsSearch')}
                                />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>
                        <ListBox items={labelItems}>
                            {(item) => (
                                <ListBox.Item
                                    id={item.id}
                                    textValue={item.label}
                                >
                                    {item.label}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            )}
                        </ListBox>
                    </Autocomplete.Filter>
                </Autocomplete.Popover>
            </Autocomplete>

            {labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {labels.map((label) => (
                        <Chip
                            key={label}
                            variant="secondary"
                            color="accent"
                            className="cursor-pointer"
                            onClick={() =>
                                onLabelsChange(
                                    labels.filter((item) => item !== label),
                                )
                            }
                        >
                            {label} x
                        </Chip>
                    ))}
                </div>
            )}

            <Select
                placeholder={t('tasks.form.assigneePlaceholder')}
                variant="secondary"
                value={assigneeId || undefined}
                onChange={(key) => onAssigneeChange(key as string)}
            >
                <Label>{t('tasks.form.assignee')}</Label>
                <Select.Trigger>
                    <Select.Value>{selectedAssignee?.name}</Select.Value>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox items={assignees}>
                        {(item) => (
                            <ListBox.Item id={item.id} textValue={item.name}>
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7 text-xs">
                                        <Avatar.Fallback
                                            className="text-white"
                                            style={{
                                                backgroundColor:
                                                    item.color ??
                                                    'var(--color-accent)',
                                            }}
                                        >
                                            {item.initials}
                                        </Avatar.Fallback>
                                    </Avatar>
                                    <span className="text-sm">{item.name}</span>
                                </div>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        )}
                    </ListBox>
                </Select.Popover>
            </Select>
        </div>
    )
}
