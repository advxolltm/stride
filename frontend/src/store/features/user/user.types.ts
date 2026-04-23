export type ApiErrorResponse = {
    error: string
}

export type ApiUser = {
    ID: string
    Username: string
    Email: string
    PasswordHash?: string
    FullName: string | null
    AvatarURL: string | null
    CreatedAt: string
    UpdatedAt: string
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
