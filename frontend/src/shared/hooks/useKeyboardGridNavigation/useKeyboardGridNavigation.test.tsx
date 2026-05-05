// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardGridNavigation } from './index'
;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface HarnessProps {
    itemCount?: number
    columns?: number
    interceptInitialPageKeyDown?: boolean
}

function Harness({
    itemCount = 4,
    columns = 2,
    interceptInitialPageKeyDown = true,
}: HarnessProps) {
    const keyboardNavigation = useKeyboardGridNavigation<HTMLButtonElement>({
        itemCount,
        getColumnCount: () => columns,
        interceptInitialPageKeyDown,
    })

    return (
        <div>
            {Array.from({ length: itemCount }, (_, index) => {
                const itemProps = keyboardNavigation.getItemProps(index)

                return (
                    <button
                        key={index}
                        data-testid={`item-${index}`}
                        ref={itemProps.itemRef}
                        tabIndex={itemProps.tabIndex}
                        onFocus={itemProps.onFocus}
                        onKeyDown={itemProps.onKeyDown}
                    >
                        Item {index}
                    </button>
                )
            })}
        </div>
    )
}

describe('useKeyboardGridNavigation', () => {
    let container: HTMLDivElement
    let root: Root

    const getButton = (index: number) => {
        const button = container.querySelector<HTMLButtonElement>(
            `[data-testid="item-${index}"]`,
        )

        if (!button) {
            throw new Error(`Button ${index} not found`)
        }

        return button
    }

    const renderHarness = (props?: HarnessProps) => {
        act(() => {
            root.render(<Harness {...props} />)
        })
    }

    const dispatchKeyDown = (target: Window | HTMLElement, key: string) => {
        const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
        })

        act(() => {
            target.dispatchEvent(event)
        })

        return event
    }

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
        root = createRoot(container)
    })

    afterEach(() => {
        act(() => {
            root.unmount()
        })
        container.remove()
        document.body.innerHTML = ''
        vi.restoreAllMocks()
    })

    it('sets roving tabindex with first item active by default', () => {
        renderHarness({ itemCount: 3 })

        expect(getButton(0).tabIndex).toBe(0)
        expect(getButton(1).tabIndex).toBe(-1)
        expect(getButton(2).tabIndex).toBe(-1)
    })

    it('moves focus across grid with arrow keys', () => {
        renderHarness({ itemCount: 4, columns: 2 })

        const firstButton = getButton(0)
        const secondRowButton = getButton(2)
        const leftNeighborButton = getButton(1)

        act(() => {
            firstButton.focus()
        })

        dispatchKeyDown(firstButton, 'ArrowDown')
        expect(document.activeElement).toBe(secondRowButton)
        expect(secondRowButton.tabIndex).toBe(0)

        dispatchKeyDown(secondRowButton, 'ArrowLeft')
        expect(document.activeElement).toBe(leftNeighborButton)
        expect(leftNeighborButton.tabIndex).toBe(0)
    })

    it('focuses and activates first item on initial Enter from page focus', () => {
        renderHarness({ itemCount: 2 })

        const firstButton = getButton(0)
        const clickSpy = vi.fn()
        firstButton.addEventListener('click', clickSpy)

        dispatchKeyDown(window, 'Enter')

        expect(document.activeElement).toBe(firstButton)
        expect(clickSpy).toHaveBeenCalledTimes(1)
    })

    it('skips initial page interception when option disabled', () => {
        renderHarness({ itemCount: 2, interceptInitialPageKeyDown: false })

        const firstButton = getButton(0)
        const clickSpy = vi.fn()
        firstButton.addEventListener('click', clickSpy)

        dispatchKeyDown(window, 'Enter')

        expect(document.activeElement).not.toBe(firstButton)
        expect(clickSpy).not.toHaveBeenCalled()
    })
})
