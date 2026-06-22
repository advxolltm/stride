import type { Key } from '@heroui/react'
import {
    Autocomplete,
    Chip,
    EmptyState,
    ListBox,
    SearchField,
    useFilter,
} from '@heroui/react'
import { Filter } from 'lucide-react'
import { useCallback, useState } from 'react'

interface FilterAutocompleteProps {
    label: string
    searchPlaceholder: string
    emptyMessage: string
    options: { id: string; label: string }[]
    selectedKeys: Set<string>
    onSelectionChange: (keys: Set<string>) => void
}

export function FilterAutocomplete({
    label,
    searchPlaceholder,
    emptyMessage,
    options,
    selectedKeys,
    onSelectionChange,
}: FilterAutocompleteProps) {
    const { contains } = useFilter({ sensitivity: 'base' })
    const [filterInput, setFilterInput] = useState('')
    const hasSelection = selectedKeys.size > 0

    const handleChange = useCallback(
        (keys: Key[]) => {
            onSelectionChange(new Set(keys as string[]))
            setFilterInput('')
        },
        [onSelectionChange],
    )

    return (
        <Autocomplete
            className="w-auto"
            placeholder={label}
            allowsEmptyCollection
            selectionMode="multiple"
            variant="secondary"
            value={[...selectedKeys]}
            onChange={handleChange}
            onClear={() => onSelectionChange(new Set())}
        >
            <Autocomplete.Trigger className="text-accent flex h-8 min-h-8 items-center gap-2 rounded-[24px] px-3 py-0 text-sm font-medium">
                <Filter size={14} className="shrink-0" />
                <Autocomplete.Value>
                    {({ defaultChildren, isPlaceholder, state }) => {
                        if (isPlaceholder || state.selectedItems.length === 0) {
                            return (
                                <span className="text-accent">
                                    {defaultChildren}
                                </span>
                            )
                        }

                        return (
                            <div className="flex items-center gap-2">
                                <span className="text-sm">{label}</span>
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    className="text-accent bg-white"
                                >
                                    {state.selectedItems.length}
                                </Chip>
                            </div>
                        )
                    }}
                </Autocomplete.Value>
                {hasSelection && <Autocomplete.ClearButton />}
            </Autocomplete.Trigger>
            <Autocomplete.Popover>
                <Autocomplete.Filter
                    filter={contains}
                    inputValue={filterInput}
                    onInputChange={setFilterInput}
                >
                    <SearchField autoFocus name="search" variant="secondary">
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input
                                placeholder={searchPlaceholder}
                                className="text-base"
                                style={{ fontSize: 14 }}
                            />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                    <ListBox
                        selectionMode="multiple"
                        renderEmptyState={() => (
                            <EmptyState>{emptyMessage}</EmptyState>
                        )}
                    >
                        {options.map((option) => (
                            <ListBox.Item
                                key={option.id}
                                id={option.id}
                                textValue={option.label}
                            >
                                {option.label}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Autocomplete.Filter>
            </Autocomplete.Popover>
        </Autocomplete>
    )
}
