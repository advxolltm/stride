import { describe, expect, it } from 'vitest'
import getInitials from './getInitials'

describe('getInitials', () => {
    it('should return initials for first two words when name has irregular whitespace', () => {
        expect(getInitials('  Ada   Lovelace  ')).toBe('AL')
    })

    it('should return empty string for blank names', () => {
        expect(getInitials('     ')).toBe('')
    })
})
