export function parseExpectedDurationHoursInput(
    value: string,
): number | null {
    const trimmed = value.trim()
    if (!trimmed) {
        return null
    }

    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed) || parsed < 0) {
        return null
    }

    return parsed
}

export function sanitizeExpectedDurationHoursInput(value: string): string {
    return /^\d*$/.test(value) ? value : ''
}

export function formatExpectedDurationHoursInput(
    value: number | null,
): string {
    return value == null ? '' : String(value)
}
