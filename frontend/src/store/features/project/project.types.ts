import { z } from 'zod'

const AvatarUrlSetSchema = z
    .object({
        300: z.string(),
        600: z.string(),
        original: z.string(),
    })
    .nullable()

export const ProjectRoleSchema = z.enum(['owner', 'member'])
export const ProjectLifecycleStatusSchema = z.enum(['active', 'archived'])

export const ApiProjectUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    full_name: z.string().nullable(),
    avatar_url: AvatarUrlSetSchema,
})

export type ApiProjectUser = z.infer<typeof ApiProjectUserSchema>

export const ApiProjectSkillSchema = z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
})

export type ApiProjectSkill = z.infer<typeof ApiProjectSkillSchema>
export const ApiProjectSkillListSchema = z.array(ApiProjectSkillSchema)

export const ApiProjectMemberSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    project_id: z.string(),
    role: ProjectRoleSchema,
    joined_at: z.string(),
    user: ApiProjectUserSchema,
})

export type ApiProjectMember = z.infer<typeof ApiProjectMemberSchema>
export const ApiProjectMemberListSchema = z.array(ApiProjectMemberSchema)

export const ApiProjectSchema = z.object({
    id: z.string(),
    created_by: z.string().nullable(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    join_link: z.string().nullable(),
    creator: ApiProjectUserSchema,
    members: ApiProjectMemberListSchema,
    skills: ApiProjectSkillListSchema.optional(),
})

export type ApiProject = z.infer<typeof ApiProjectSchema>
export const ApiProjectListSchema = z.array(ApiProjectSchema)

export const ProjectUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    fullName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    avatarSmallUrl: z.string().nullable().optional(),
})

export type ProjectUser = z.infer<typeof ProjectUserSchema>

export const ProjectMemberSchema = z.object({
    id: z.string(),
    userId: z.string(),
    projectId: z.string(),
    role: ProjectRoleSchema,
    joinedAt: z.string(),
    user: ProjectUserSchema,
})

export type ProjectMember = z.infer<typeof ProjectMemberSchema>

export const ProjectSkillSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
})

export type ProjectSkill = z.infer<typeof ProjectSkillSchema>

export const ProjectSchema = z.object({
    id: z.string(),
    createdBy: z.string().nullable(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    joinLink: z.string().nullable(),
    creator: ProjectUserSchema,
    members: z.array(ProjectMemberSchema),
    skills: z.array(ProjectSkillSchema),
})

export type Project = z.infer<typeof ProjectSchema>

export const CreateProjectRequestSchema = z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    status: ProjectLifecycleStatusSchema,
})

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>

export const UpdateProjectRequestSchema =
    CreateProjectRequestSchema.partial()

export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>

export const CreateProjectSkillRequestSchema = z.object({
    name: z.string(),
    description: z.string().nullable(),
})

export type CreateProjectSkillRequest = z.infer<
    typeof CreateProjectSkillRequestSchema
>

export const AddProjectMemberSchema = z.object({
    userid: z.string(),
    role: ProjectRoleSchema,
})

export const AddProjectMembersRequestSchema = z.array(AddProjectMemberSchema)

export type AddProjectMembersRequest = z.infer<
    typeof AddProjectMembersRequestSchema
>
