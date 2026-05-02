import { Input } from '@heroui/react'

interface SkillSearchInputProps {
    search: string
    searchPlaceholder: string
    onSearchChange: (value: string) => void
}

export function SkillSearchInput({
    search,
    searchPlaceholder,
    onSearchChange,
}: Readonly<SkillSearchInputProps>) {
    return (
        <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            variant="primary"
            autoComplete="off"
            className="w-full"
        />
    )
}
