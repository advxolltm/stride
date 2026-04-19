const AUTH_STORAGE_KEY = 'stride_auth'

export const saveAuthState = (isAuthenticated: boolean) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ isAuthenticated }))
}

export const loadAuthState = (): boolean => {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY)
        if (!raw) {
            return false
        }

        const parsed = JSON.parse(raw) as { isAuthenticated?: unknown }
        return parsed.isAuthenticated === true
    } catch {
        return false
    }
}

export const clearAuthState = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
}
