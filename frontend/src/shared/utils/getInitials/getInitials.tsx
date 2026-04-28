export function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)

    if (words.length === 0) {
        return ''
    }

    return words
        .map((word) => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
}

export default getInitials
