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
    working_hours: z.number(),
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
    workingHours: z.number(),
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

export const SchedulerOptimizationGoalSchema = z.enum([
    'distribute-evenly',
    'max-hours-scheduled',
    'max-tasks-scheduled',
])

export const SchedulerSettingsSchema = z.object({
    optimization_goals: z.array(SchedulerOptimizationGoalSchema),
    timeout_seconds: z.number().int().positive().optional(),
})

export type SchedulerSettings = z.infer<typeof SchedulerSettingsSchema>

export const SchedulerScheduleRequestSchema = z.object({
    task_ids: z.array(z.string()),
    user_ids: z.array(z.string()),
    settings: SchedulerSettingsSchema,
})

export type SchedulerScheduleRequest = z.infer<
    typeof SchedulerScheduleRequestSchema
>

export const ApiSchedulerAssignmentSchema = z.object({
    user_id: z.nullable(z.string()),
    task_id: z.string(),
})

export type ApiSchedulerAssignment = z.infer<
    typeof ApiSchedulerAssignmentSchema
>
export const ApiSchedulerAssignmentListSchema = z.array(
    ApiSchedulerAssignmentSchema,
)

export const ApiSchedulerPreviewResponseSchema = z.object({
    new_assignments: ApiSchedulerAssignmentListSchema,
    changed_assignments: ApiSchedulerAssignmentListSchema,
    incompatible_assignments: ApiSchedulerAssignmentListSchema,
})

export type ApiSchedulerPreviewResponse = z.infer<
    typeof ApiSchedulerPreviewResponseSchema
>

export const SchedulerAssignmentSchema = z.object({
    userId: z.nullable(z.string()),
    taskId: z.string(),
})

export type SchedulerAssignment = z.infer<typeof SchedulerAssignmentSchema>

export const SchedulerPreviewResponseSchema = z.object({
    newAssignments: z.array(SchedulerAssignmentSchema),
    changedAssignments: z.array(SchedulerAssignmentSchema),
    incompatibleAssignments: z.array(SchedulerAssignmentSchema),
})

export type SchedulerPreviewResponse = z.infer<
    typeof SchedulerPreviewResponseSchema
>

export const SchedulerConfirmRequestSchema = z.array(
    ApiSchedulerAssignmentSchema,
)

export type SchedulerConfirmRequest = z.infer<
    typeof SchedulerConfirmRequestSchema
>
