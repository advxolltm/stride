export type ApiErrorResponse = {
    error: string
}

export type ApiUser = {
    id: string
    username: string
    email: string
    password_hash?: string
    full_name: string | null
    avatar_url: { 300: string; 600: string; original: string } | null
}

export type CreateUserRequest = {
    username: string
    email: string
    password: string
}

export type UpdateUserRequest = Partial<{
    email: string
    password: string
    full_name: string
    avatar_url: string
}>
