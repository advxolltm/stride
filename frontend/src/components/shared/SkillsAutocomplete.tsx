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
import { type Key, useEffect, useRef, useState } from 'react'

interface SkillsAutocompleteProps {
    label: string
    placeholder: string
    searchPlaceholder?: string
    options: string[]
    selectedSkills: string[]
    onChange: (skills: string[]) => void
    className?: string
}

export function SkillsAutocomplete({
    label,
    placeholder,
    searchPlaceholder,
    options,
    selectedSkills,
    onChange,
    className,
}: Readonly<SkillsAutocompleteProps>) {
    const { contains } = useFilter({ sensitivity: 'base' })

    const wrapperRef = useRef<HTMLDivElement>(null)
    const [popoverWidth, setPopoverWidth] = useState<number>(0)

    useEffect(() => {
        const updateWidth = () => {
            if (wrapperRef.current) {
                setPopoverWidth(wrapperRef.current.offsetWidth)
            }
        }

        updateWidth()

        const resizeObserver = new ResizeObserver(updateWidth)
        if (wrapperRef.current) {
            resizeObserver.observe(wrapperRef.current)
        }

        window.addEventListener('resize', updateWidth)

        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('resize', updateWidth)
        }
    }, [])

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
                                <TagGroup size="sm" onRemove={handleRemoveTags}>
                                    <TagGroup.List className="gap-1.5 bg-transparent">
                                        {state.selectedItems.map((item) => (
                                            <Tag
                                                key={item.key}
                                                id={item.key}
                                                className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--surface-foreground)] shadow-none"
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

                <Autocomplete.Popover
                    placement="bottom"
                    shouldFlip={false}
                    style={{ width: popoverWidth }}
                >
                    <Autocomplete.Filter filter={contains}>
                        <SearchField
                            autoFocus
                            name="search"
                            variant="secondary"
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
                                <EmptyState>No results found</EmptyState>
                            )}
                        >
                            {options.map((skill) => (
                                <ListBox.Item
                                    key={skill}
                                    id={skill}
                                    textValue={skill}
                                >
                                    {skill}
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
