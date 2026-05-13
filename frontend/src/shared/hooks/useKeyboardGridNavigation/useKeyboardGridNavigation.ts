import {
    useEffect,
    useRef,
    useState,
    type FocusEventHandler,
    type KeyboardEventHandler,
    type RefCallback,
} from 'react'

interface UseKeyboardGridNavigationOptions {
    itemCount: number
    getColumnCount: () => number
    interceptInitialPageKeyDown?: boolean
}

interface KeyboardGridItemProps<T extends HTMLElement> {
    itemRef: RefCallback<T>
    tabIndex: number
    onFocus: FocusEventHandler<T>
    onKeyDown: KeyboardEventHandler<T>
}

export function useKeyboardGridNavigation<T extends HTMLElement>({
    itemCount,
    getColumnCount,
    interceptInitialPageKeyDown = true,
}: UseKeyboardGridNavigationOptions) {
    const itemRefs = useRef<Array<T | null>>([])
    const [activeIndex, setActiveIndex] = useState(0)
    const selectedIndex =
        itemCount > 0 ? Math.min(activeIndex, itemCount - 1) : -1

    const focusItem = (index: number) => {
        if (!itemCount) {
            return
        }

        const nextIndex = Math.max(0, Math.min(index, itemCount - 1))
        const nextItem = itemRefs.current[nextIndex]

        if (!nextItem) {
            return
        }

        setActiveIndex(nextIndex)
        nextItem.focus()
    }

    useEffect(() => {
        if (!interceptInitialPageKeyDown || !itemCount) {
            return
        }

        const handleInitialPageKeyDown = (event: globalThis.KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                event.isComposing ||
                event.key === 'Tab' ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey
            ) {
                return
            }

            const activeElement = document.activeElement
            const isItemFocused = itemRefs.current.some(
                (item) => item === activeElement,
            )

            if (
                isItemFocused ||
                (activeElement &&
                    activeElement !== document.body &&
                    activeElement !== document.documentElement)
            ) {
                return
            }

            const firstItem = itemRefs.current[0]

            if (!firstItem) {
                return
            }

            event.preventDefault()
            setActiveIndex(0)
            firstItem.focus()

            if (event.key === 'Enter') {
                firstItem.click()
            }
        }

        window.addEventListener('keydown', handleInitialPageKeyDown)

        return () => {
            window.removeEventListener('keydown', handleInitialPageKeyDown)
        }
    }, [interceptInitialPageKeyDown, itemCount])

    const getItemProps = (index: number): KeyboardGridItemProps<T> => ({
        itemRef: (element) => {
            itemRefs.current[index] = element
        },
        tabIndex: selectedIndex === index ? 0 : -1,
        onFocus: () => {
            setActiveIndex(index)
        },
        onKeyDown: (event) => {
            switch (event.key) {
                case 'ArrowRight':
                    index = Math.min(index + 1, itemCount - 1)
                    break
                case 'ArrowLeft':
                    index = Math.max(index - 1, 0)
                    break
                case 'ArrowDown':
                    index = Math.min(
                        index + getColumnCount(),
                        itemCount - 1,
                    )
                    break
                case 'ArrowUp':
                    index = Math.max(index - getColumnCount(), 0)
                    break
                case 'Home':
                    index = 0
                    break
                case 'End':
                    index = itemCount - 1
                    break
                case 'Enter':
                    return
                default:
                    return
            }

            event.preventDefault()
            focusItem(index)
        },
    })

    return {
        getItemProps,
    }
}
