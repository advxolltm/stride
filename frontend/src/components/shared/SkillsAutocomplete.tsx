'use client'

import {
    Autocomplete,
    EmptyState,
    Label,
    ListBox,
    SearchField,
    Tag,
    TagGroup,
    useFilter,
} from '@heroui/react'
import { type Key, useRef } from 'react'

type SkillOption = string | { id: string; label: string }

interface SkillsAutocompleteProps {
    label: string
    placeholder: string
    searchPlaceholder?: string
    emptyStateMessage?: string
    options: SkillOption[]
    selectedSkills: string[]
    onChange: (skills: string[]) => void
    className?: string
}

export function SkillsAutocomplete({
    label,
    placeholder,
    searchPlaceholder,
    emptyStateMessage,
    options,
    selectedSkills,
    onChange,
    className,
}: Readonly<SkillsAutocompleteProps>) {
    const { contains } = useFilter({ sensitivity: 'base' })
    const normalizedOptions = options.map((option) =>
        typeof option === 'string' ? { id: option, label: option } : option,
    )

    const wrapperRef = useRef<HTMLDivElement>(null)

    const handleSelectionChange = (keys: Key[]) => {
        onChange(keys as string[])
    }

    const handleRemoveTags = (keys: Set<Key>) => {
        onChange(
            selectedSkills.filter((selectedSkill) => !keys.has(selectedSkill)),
        )
    }

    return (
        <div ref={wrapperRef} className={className}>
            <Autocomplete
                variant="secondary"
                fullWidth
                className="w-full"
                placeholder={placeholder}
                allowsEmptyCollection
                selectionMode="multiple"
                value={selectedSkills}
                onChange={handleSelectionChange}
                onClear={() => onChange([])}
            >
                <Label>{label}</Label>

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
                                    aria-label="Selected skills"
                                    size="sm"
                                    onRemove={handleRemoveTags}
                                >
                                    <TagGroup.List className="gap-1.5 bg-transparent">
                                        {state.selectedItems.map((item) => (
                                            <Tag
                                                key={item.key}
                                                id={item.key}
                                                className="border-border bg-surface text-surface-foreground border px-2 py-1 shadow-none"
                                            >
                                                {item.textValue}
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
                            aria-label="Search skills"
                        >
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input
                                    placeholder={
                                        searchPlaceholder ?? placeholder
                                    }
                                />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>

                        <ListBox
                            selectionMode="multiple"
                            renderEmptyState={() => (
                                <EmptyState>
                                    {emptyStateMessage ?? 'No results found'}
                                </EmptyState>
                            )}
                        >
                            {normalizedOptions.map((skill) => (
                                <ListBox.Item
                                    key={skill.id}
                                    id={skill.id}
                                    textValue={skill.label}
                                >
                                    {skill.label}
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
