import { Button } from '@heroui/react'
import { useState } from 'react'

interface WorkingHoursAllocationCardProps {
    title: string
    subtitle: string
    hours: number
    maxHours: number
    onChange: (hours: number) => void
    inputAriaLabel: string
    availabilityLabel: string
    integerErrorLabel: string
    rangeErrorLabel: string
    isEditable?: boolean
    initials?: string
    color?: string
}

export function WorkingHoursAllocationCard({
    title,
    subtitle,
    hours,
    maxHours,
    onChange,
    inputAriaLabel,
    availabilityLabel,
    integerErrorLabel,
    rangeErrorLabel,
    isEditable = true,
    initials,
    color,
}: Readonly<WorkingHoursAllocationCardProps>) {
    const [draftValue, setDraftValue] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const inputValue = draftValue ?? String(hours)

    const validateValue = (
        rawValue: string,
    ): { value: number } | { error: string } => {
        const trimmed = rawValue.trim()

        if (!trimmed) {
            return { error: rangeErrorLabel }
        }

        if (!/^\d+$/.test(trimmed)) {
            return { error: integerErrorLabel }
        }

        const nextHours = Number(trimmed)
        if (nextHours < 0 || nextHours > maxHours) {
            return { error: rangeErrorLabel }
        }

        return { value: nextHours }
    }

    return (
        <div className="border-border bg-surface rounded-2xl border p-5">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <div className="flex min-w-0 items-center gap-3">
                    {initials ? (
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                            style={{
                                backgroundColor: color ?? 'var(--accent)',
                            }}
                        >
                            {initials}
                        </div>
                    ) : null}

                    <div className="min-w-0">
                        <p className="truncate text-base font-semibold">
                            {title}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        isIconOnly
                        onPress={() => {
                            setDraftValue(null)
                            setError(null)
                            onChange(Math.max(0, hours - 1))
                        }}
                        isDisabled={!isEditable || hours <= 0}
                    >
                        -
                    </Button>
                    <input
                        aria-label={inputAriaLabel}
                        type="number"
                        min={0}
                        max={maxHours}
                        step={1}
                        value={inputValue}
                        disabled={!isEditable}
                        onChange={(event) => {
                            const nextValue = event.target.value
                            setDraftValue(nextValue)
                            const result = validateValue(nextValue)
                            if ('error' in result) {
                                setError(result.error)
                                return
                            }

                            setError(null)
                            onChange(result.value)
                        }}
                        onBlur={() => {
                            const result = validateValue(inputValue)
                            if ('error' in result) {
                                setDraftValue(null)
                                setError(null)
                                return
                            }

                            setError(null)
                            setDraftValue(null)
                            onChange(result.value)
                        }}
                        className={`border-border bg-background h-9 w-20 rounded-xl border px-3 text-center text-sm outline-none ${error ? 'border-danger text-danger' : ''}`}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        isIconOnly
                        onPress={() => {
                            setDraftValue(null)
                            setError(null)
                            onChange(Math.min(maxHours, hours + 1))
                        }}
                        isDisabled={!isEditable || hours >= maxHours}
                    >
                        +
                    </Button>
                </div>
            </div>

            <p
                className={`mt-3 text-sm ${error ? 'text-danger' : 'text-muted-foreground'}`}
            >
                {error ?? availabilityLabel}
            </p>
        </div>
    )
}
