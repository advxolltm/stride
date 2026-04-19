export type LoginRequest = {
    email: string
    password: string
}

export type AuthState = {
    isAuthenticated: boolean
    isInitialized: boolean
}
