import { useCallback, useSyncExternalStore } from 'react'

const canUseMatchMedia = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'

export const useMediaQuery = (query: string): boolean => {
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            if (!canUseMatchMedia()) {
                return () => {}
            }

            const media = window.matchMedia(query)
            media.addEventListener('change', onStoreChange)

            return () => {
                media.removeEventListener('change', onStoreChange)
            }
        },
        [query],
    )

    const getSnapshot = useCallback(() => {
        if (!canUseMatchMedia()) {
            return false
        }

        return window.matchMedia(query).matches
    }, [query])

    return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export default useMediaQuery
