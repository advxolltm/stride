const env = import.meta.env as Record<string, string | undefined>

const readEnv = (key: string, viteKey = `VITE_${key}`) =>
    env[key] ?? env[viteKey]

const parsePositiveInt = (value: unknown, fallback: number) => {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const parseBoolean = (value: unknown, fallback: boolean) => {
    if (typeof value !== 'string') return fallback

    switch (value.toLowerCase()) {
        case 'true':
        case '1':
        case 'yes':
        case 'on':
            return true
        case 'false':
        case '0':
        case 'no':
        case 'off':
            return false
        default:
            return fallback
    }
}

export const validationPolicy = {
    passwordMinLength: parsePositiveInt(readEnv('PASSWORD_MIN_LENGTH'), 8),
    passwordRequireSpecialChar: parseBoolean(
        readEnv('PASSWORD_REQUIRE_SPECIAL_CHAR'),
        true,
    ),
    passwordRequireNumber: parseBoolean(readEnv('PASSWORD_REQUIRE_NUM'), true),
    usernameMinLength: parsePositiveInt(readEnv('USERNAME_MIN_LENGTH'), 3),
    usernameMaxLength: parsePositiveInt(readEnv('USERNAME_MAX_LENGTH'), 255),
}
