import { z } from 'zod'
import { ApiErrorResponseSchema } from '../../../shared/utils/api/types'

export { ApiErrorResponseSchema }
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>

const AvatarUrlSetSchema = z
    .object({
        300: z.string(),
        600: z.string(),
        original: z.string(),
    })
    .nullable()

export const ApiUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    password_hash: z.string().optional(),
    full_name: z.string().nullable(),
    avatar_url: AvatarUrlSetSchema,
})

export type ApiUser = z.infer<typeof ApiUserSchema>
export const ApiUserListSchema = z.array(ApiUserSchema)

const ApiUserSkillProjectSkillSchema = z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
})

export const ApiUserSkillSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    project_skill_id: z.string(),
    project_skill: ApiUserSkillProjectSkillSchema,
})

export type ApiUserSkill = z.infer<typeof ApiUserSkillSchema>
export const ApiUserSkillListSchema = z.array(ApiUserSkillSchema)

export const UserSkillSchema = z.object({
    id: z.string(),
    userId: z.string(),
    projectSkillId: z.string(),
    projectSkill: z.object({
        id: z.string(),
        projectId: z.string(),
        name: z.string(),
        description: z.string().nullable(),
    }),
})

export type UserSkill = z.infer<typeof UserSkillSchema>

export const CreateUserRequestSchema = z.object({
    username: z.string(),
    email: z.string(),
    password: z.string(),
})

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>

export const UpdateUserRequestSchema = z.object({
    email: z.string().optional(),
    full_name: z.string().optional(),
})

export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>

export const ChangePasswordRequestSchema = z.object({
    current_password: z.string(),
    new_password: z.string(),
})

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>

export const UpdateUserProjectSkillsRequestSchema = z.object({
    project_skill_ids: z.array(z.string()),
})

export type UpdateUserProjectSkillsRequest = z.infer<
    typeof UpdateUserProjectSkillsRequestSchema
>
