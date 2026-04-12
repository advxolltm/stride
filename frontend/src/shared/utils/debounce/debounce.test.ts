import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import debounce from './debounce'

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('standard cases', () => {
        it('should delay function execution', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 300)

            debouncedFn('test')

            expect(mockFn).not.toHaveBeenCalled()

            vi.advanceTimersByTime(300)
            expect(mockFn).toHaveBeenCalledTimes(1)
            expect(mockFn).toHaveBeenCalledWith('test')
        })

        it('should pass all arguments to the debounced function', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 100)

            debouncedFn('arg1', 'arg2', 'arg3')

            vi.advanceTimersByTime(100)

            expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3')
        })

        it('should handle multiple argument types', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 100)

            debouncedFn(42, 'string', { key: 'value' }, [1, 2, 3])

            vi.advanceTimersByTime(100)

            expect(mockFn).toHaveBeenCalledWith(
                42,
                'string',
                { key: 'value' },
                [1, 2, 3],
            )
        })
    })

    describe('debouncing behavior', () => {
        it('should cancel previous timer when called multiple times', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 300)

            debouncedFn('call1')
            vi.advanceTimersByTime(100)

            debouncedFn('call2')
            vi.advanceTimersByTime(100)

            debouncedFn('call3')
            vi.advanceTimersByTime(100)

            expect(mockFn).not.toHaveBeenCalled()

            vi.advanceTimersByTime(300)
            expect(mockFn).toHaveBeenCalledTimes(1)
            expect(mockFn).toHaveBeenCalledWith('call3')
        })

        it('should reset timer on each new call', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 500)

            debouncedFn('first')
            vi.advanceTimersByTime(400)

            debouncedFn('second')
            vi.advanceTimersByTime(400)

            expect(mockFn).not.toHaveBeenCalled()

            vi.advanceTimersByTime(100)
            expect(mockFn).toHaveBeenCalledTimes(1)
            expect(mockFn).toHaveBeenCalledWith('second')
        })

        it('should allow multiple executions with proper timing', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 200)

            debouncedFn('first')
            vi.advanceTimersByTime(200)
            expect(mockFn).toHaveBeenCalledWith('first')

            debouncedFn('second')
            vi.advanceTimersByTime(200)
            expect(mockFn).toHaveBeenCalledWith('second')

            expect(mockFn).toHaveBeenCalledTimes(2)
        })
    })

    describe('edge cases', () => {
        it('should handle zero delay', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 0)

            debouncedFn('test')
            vi.advanceTimersByTime(0)

            expect(mockFn).toHaveBeenCalledWith('test')
        })

        it('should handle very large delay', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 10000)

            debouncedFn('test')
            vi.advanceTimersByTime(9999)
            expect(mockFn).not.toHaveBeenCalled()

            vi.advanceTimersByTime(1)
            expect(mockFn).toHaveBeenCalledWith('test')
        })

        it('should handle calls with no arguments', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 100)

            debouncedFn()
            vi.advanceTimersByTime(100)

            expect(mockFn).toHaveBeenCalledTimes(1)
            expect(mockFn).toHaveBeenCalledWith()
        })

        it('should handle undefined arguments', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 100)

            debouncedFn(undefined, undefined)
            vi.advanceTimersByTime(100)

            expect(mockFn).toHaveBeenCalledWith(undefined, undefined)
        })

        it('should handle null arguments', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 100)

            debouncedFn(null)
            vi.advanceTimersByTime(100)

            expect(mockFn).toHaveBeenCalledWith(null)
        })
    })

    describe('timer management', () => {
        it('should clear previous timer when called again', () => {
            const mockFn = vi.fn()
            const debouncedFn = debounce(mockFn, 300)

            debouncedFn('first')
            const timer1 = vi.getTimerCount()

            debouncedFn('second')
            const timer2 = vi.getTimerCount()

            expect(timer1).toBe(timer2)
        })
    })
})
