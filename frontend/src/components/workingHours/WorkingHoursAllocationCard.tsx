import { Button } from '@heroui/react'

interface WorkingHoursAllocationCardProps {
    title: string
    subtitle: string
    hours: number
    maxHours: number
    onChange: (hours: number) => void
    initials?: string
    color?: string
}

export function WorkingHoursAllocationCard({
    title,
    subtitle,
    hours,
    maxHours,
    onChange,
    initials,
    color,
}: Readonly<WorkingHoursAllocationCardProps>) {
    return (
        <div className="border-border bg-surface rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    {initials ? (
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                            style={{ backgroundColor: color ?? 'var(--accent)' }}
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
                        onPress={() => onChange(Math.max(0, hours - 1))}
                        isDisabled={hours <= 0}
                    >
                        -
                    </Button>
                    <div className="border-border bg-background flex h-9 min-w-14 items-center justify-center rounded-xl border px-3 text-sm">
                        {hours}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        isIconOnly
                        onPress={() => onChange(Math.min(maxHours, hours + 1))}
                        isDisabled={hours >= maxHours}
                    >
                        +
                    </Button>
                </div>
            </div>

            <input
                type="range"
                min={0}
                max={maxHours}
                step={1}
                value={hours}
                onChange={(event) => onChange(Number(event.target.value))}
                className="accent-accent mt-4 w-full cursor-pointer"
            />
        </div>
    )
}
