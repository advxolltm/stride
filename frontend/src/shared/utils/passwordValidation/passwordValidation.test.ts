import { describe, expect, it } from 'vitest'

import { passwordMinLength, validateStrongPassword } from './passwordValidation'

describe('validateStrongPassword', () => {
    it('rejects passwords shorter than the minimum length', () => {
        expect(validateStrongPassword('Short!1')).toEqual({
            isValid: false,
            error: 'passwordTooShort',
        })
    })

    it('rejects passwords without a special character', () => {
        expect(validateStrongPassword('Password123')).toEqual({
            isValid: false,
            error: 'passwordMissingSpecial',
        })
    })

    it('rejects passwords without a number', () => {
        expect(validateStrongPassword('Password!')).toEqual({
            isValid: false,
            error: 'passwordMissingNumber',
        })
    })

    it('accepts passwords with the minimum length, a special character, and a number', () => {
        expect(
            validateStrongPassword('A'.repeat(passwordMinLength - 2) + '!1'),
        ).toEqual({ isValid: true })
    })
})
