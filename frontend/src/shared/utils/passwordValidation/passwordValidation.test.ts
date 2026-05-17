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

    it('accepts passwords with the minimum length and a special character', () => {
        expect(
            validateStrongPassword('A'.repeat(passwordMinLength - 1) + '!'),
        ).toEqual({ isValid: true })
    })
})
