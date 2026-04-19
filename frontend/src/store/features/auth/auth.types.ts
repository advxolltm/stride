export type LoginRequest = {
    email: string
    password: string
}

export type ApiErrorResponse = {
    error: string
}
export type AuthState = {
    isAuthenticated: boolean
    isInitialized: boolean
}
