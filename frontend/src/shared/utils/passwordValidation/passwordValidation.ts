export const passwordMinLength = 8
export const passwordSpecialChars = '!@#$%^&*'

export type PasswordValidationError = 'passwordTooShort' | 'passwordMissingSpecial'

export type PasswordValidationResult =
    | { isValid: true }
    | { isValid: false; error: PasswordValidationError }

export const validateStrongPassword = (password: string): PasswordValidationResult => {
    if (password.length < passwordMinLength)
        return { isValid: false, error: 'passwordTooShort' }

    if (!new RegExp(`[${passwordSpecialChars}]`).test(password))
        return { isValid: false, error: 'passwordMissingSpecial' }

    return { isValid: true }
}