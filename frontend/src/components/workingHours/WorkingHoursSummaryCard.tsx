interface WorkingHoursSummaryCardProps {
    allocated: number
    remaining: number
    total: number
    allocatedLabel: string
    remainingLabel: string
}

export function WorkingHoursSummaryCard({
    allocated,
    remaining,
    total,
    allocatedLabel,
    remainingLabel,
}: Readonly<WorkingHoursSummaryCardProps>) {
    const progress = Math.min((allocated / total) * 100, 100)

    return (
        <div className="border-border bg-surface rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-muted-foreground text-sm">
                        {allocatedLabel}
                    </p>
                    <p className="text-3xl font-semibold tracking-tight">
                        {allocated}
                        <span className="text-muted-foreground text-xl font-medium">
                            /{total}h
                        </span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-muted-foreground text-sm">
                        {remainingLabel}
                    </p>
                    <p className="text-accent text-3xl font-semibold tracking-tight">
                        {remaining}
                        <span className="text-muted-foreground text-xl font-medium">
                            h
                        </span>
                    </p>
                </div>
            </div>

            <div className="bg-default-100 mt-4 h-2 rounded-full">
                <div
                    className="bg-accent h-2 rounded-full transition-[width]"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    )
}
