import { validationPolicy } from '../../../config/validationPolicy'

export const passwordMinLength = validationPolicy.passwordMinLength
export const passwordRequireSpecialChar =
    validationPolicy.passwordRequireSpecialChar
export const passwordRequireNumber = validationPolicy.passwordRequireNumber
export const passwordSpecialChars = '!@#$%^&*'

export type PasswordValidationError =
    | 'passwordTooShort'
    | 'passwordMissingSpecial'
    | 'passwordMissingNumber'

export type PasswordValidationResult =
    | { isValid: true }
    | { isValid: false; error: PasswordValidationError }

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const specialCharPattern = new RegExp(`[${escapeRegExp(passwordSpecialChars)}]`)

export const validateStrongPassword = (
    password: string,
): PasswordValidationResult => {
    if (password.length < passwordMinLength)
        return { isValid: false, error: 'passwordTooShort' }

    if (passwordRequireSpecialChar && !specialCharPattern.test(password))
        return { isValid: false, error: 'passwordMissingSpecial' }

    if (passwordRequireNumber && !/\d/.test(password))
        return { isValid: false, error: 'passwordMissingNumber' }

    return { isValid: true }
}
