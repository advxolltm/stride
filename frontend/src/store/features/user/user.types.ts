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
    is_superuser: boolean
}

export type ApiUserSkill = {
    id: string
    user_id: string
    project_skill_id: string
    project_skill: {
        id: string
        project_id: string
        name: string
        description: string | null
    }
}

export type UserSkill = {
    id: string
    userId: string
    projectSkillId: string
    projectSkill: {
        id: string
        projectId: string
        name: string
        description: string | null
    }
}

export type CreateUserRequest = {
    username: string
    email: string
    password: string
}

export type UpdateUserRequest = Partial<{
    email: string
    full_name: string
}>

export type ChangePasswordRequest = {
    current_password: string
    new_password: string
}

export type ResetPasswordRequest = {
    new_password: string
}

export type UpdateUserProjectSkillsRequest = {
    project_skill_ids: string[]
}
