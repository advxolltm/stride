export type ApiUser = {
    ID: string
    Username: string
    Email: string
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
    fullName: string
    avatarUrl: string
}>