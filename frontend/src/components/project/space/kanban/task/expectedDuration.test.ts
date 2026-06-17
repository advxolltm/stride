import { describe, expect, it } from 'vitest'
import {
    formatExpectedDurationHoursInput,
    parseExpectedDurationHoursInput,
    sanitizeExpectedDurationHoursInput,
} from './expectedDuration'

describe('expectedDuration helpers', () => {
    it('parses whole non-negative hours', () => {
        expect(parseExpectedDurationHoursInput('0')).toBe(0)
        expect(parseExpectedDurationHoursInput('12')).toBe(12)
        expect(parseExpectedDurationHoursInput(' 7 ')).toBe(7)
    })

    it('returns null for empty, negative, or non-integer values', () => {
        expect(parseExpectedDurationHoursInput('')).toBeNull()
        expect(parseExpectedDurationHoursInput('   ')).toBeNull()
        expect(parseExpectedDurationHoursInput('-1')).toBeNull()
        expect(parseExpectedDurationHoursInput('1.5')).toBeNull()
        expect(parseExpectedDurationHoursInput('abc')).toBeNull()
    })

    it('keeps only digit-only input during sanitizing', () => {
        expect(sanitizeExpectedDurationHoursInput('')).toBe('')
        expect(sanitizeExpectedDurationHoursInput('123')).toBe('123')
        expect(sanitizeExpectedDurationHoursInput('01')).toBe('01')
        expect(sanitizeExpectedDurationHoursInput('1a')).toBe('')
        expect(sanitizeExpectedDurationHoursInput('-2')).toBe('')
        expect(sanitizeExpectedDurationHoursInput('1.5')).toBe('')
    })

    it('formats nullable values for the field input', () => {
        expect(formatExpectedDurationHoursInput(null)).toBe('')
        expect(formatExpectedDurationHoursInput(0)).toBe('0')
        expect(formatExpectedDurationHoursInput(9)).toBe('9')
    })
})
