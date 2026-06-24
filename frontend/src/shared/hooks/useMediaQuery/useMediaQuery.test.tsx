// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useMediaQuery from './useMediaQuery'

;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const QUERY = '(min-width: 768px)'

interface MatchMediaController {
    setMatches: (matches: boolean) => void
}

const mockMatchMedia = (initialMatches: boolean): MatchMediaController => {
    let matches = initialMatches
    const listeners = new Set<() => void>()

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        get matches() {
            return matches
        },
        media: query,
        addEventListener: (_event: 'change', listener: () => void) => {
            listeners.add(listener)
        },
        removeEventListener: (_event: 'change', listener: () => void) => {
            listeners.delete(listener)
        },
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
    }))

    return {
        setMatches: (nextMatches: boolean) => {
            matches = nextMatches
            listeners.forEach((listener) => listener())
        },
    }
}

function Harness({ query = QUERY }: { query?: string }) {
    const matches = useMediaQuery(query)

    return <div data-testid="result">{String(matches)}</div>
}

describe('useMediaQuery', () => {
    let container: HTMLDivElement
    let root: Root

    const renderHarness = (query = QUERY) => {
        act(() => {
            root.render(<Harness query={query} />)
        })
    }

    const getResult = () => {
        const element = container.querySelector('[data-testid="result"]')

        if (!element) {
            throw new Error('Result element not found')
        }

        return element.textContent
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

    it('returns the initial media query match state', () => {
        mockMatchMedia(true)

        renderHarness()

        expect(getResult()).toBe('true')
        expect(window.matchMedia).toHaveBeenCalledWith(QUERY)
    })

    it('updates when the media query match changes', () => {
        const mediaQuery = mockMatchMedia(false)

        renderHarness()
        expect(getResult()).toBe('false')

        act(() => {
            mediaQuery.setMatches(true)
        })

        expect(getResult()).toBe('true')
    })

    it('returns false when matchMedia is unavailable', () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: undefined,
        })

        renderHarness()

        expect(getResult()).toBe('false')
    })
})
