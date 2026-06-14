import { z } from 'zod'
import { UserSchema } from '../../../shared/types'
import {
    ApiProjectMemberSchema,
    ApiProjectSkillSchema,
} from '../project/project.types'

export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'done'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const ApiTaskAssigneeSchema = z.object({
    id: z.string(),
    task_id: z.string(),
    project_member_id: z.string(),
    assigned_at: z.string(),
    project_member: ApiProjectMemberSchema,
})

export type ApiTaskAssignee = z.infer<typeof ApiTaskAssigneeSchema>
export const ApiTaskAssigneeListSchema = z.array(ApiTaskAssigneeSchema)

export const ApiTaskSkillSchema = z.object({
    id: z.string(),
    task_id: z.string(),
    project_skill_id: z.string(),
    project_skill: ApiProjectSkillSchema,
})

export type ApiTaskSkill = z.infer<typeof ApiTaskSkillSchema>
export const ApiTaskSkillListSchema = z.array(ApiTaskSkillSchema)
export type ApiProjectSkill = z.infer<typeof ApiProjectSkillSchema>

export const ApiTaskSchema = z.object({
    id: z.string(),
    project_id: z.string(),
    created_by: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: TaskStatusSchema,
    start_date: z.string().nullable(),
    due_date: z.string().nullable(),
    expected_duration_hours: z.number().nullable(),
    position: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    completed_at: z.string().nullable(),
    task_assignees: ApiTaskAssigneeListSchema,
    task_skills: ApiTaskSkillListSchema,
})

export type ApiTask = z.infer<typeof ApiTaskSchema>
export const ApiTaskListSchema = z.array(ApiTaskSchema)

export const TaskAssigneeSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    projectMemberId: z.string(),
    assignedAt: z.string(),
    user: UserSchema,
})

export type TaskAssignee = z.infer<typeof TaskAssigneeSchema>

export const TaskSkillSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    projectSkillId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
})

export type TaskSkill = z.infer<typeof TaskSkillSchema>

export const TaskSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    createdBy: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: TaskStatusSchema,
    startDate: z.string().nullable(),
    dueDate: z.string().nullable(),
    expectedDurationHours: z.number().nullable(),
    position: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    completedAt: z.string().nullable(),
    assignees: z.array(TaskAssigneeSchema).optional(),
    skills: z.array(TaskSkillSchema).optional(),
})

export type Task = z.infer<typeof TaskSchema>

export const ColumnSchema = z.object({
    id: TaskStatusSchema,
    label: z.string(),
    dotColor: z.string(),
    tasks: z.array(TaskSchema),
})

export type Column = z.infer<typeof ColumnSchema>

export const CreateTaskRequestSchema = z.object({
    project_id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    status: TaskStatusSchema,
    start_date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    expected_duration_hours: z.number().nullable().optional(),
    position: z.number().nullable().optional(),
})

export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>

export const UpdateTaskRequestSchema = z.object({
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    status: TaskStatusSchema.nullable().optional(),
    start_date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    expected_duration_hours: z.number().nullable().optional(),
    skill_ids: z.array(z.string()).optional(),
})

export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequestSchema>

export const AssignTaskRequestSchema = z.object({
    project_member_id: z.string(),
})

export type AssignTaskRequest = z.infer<typeof AssignTaskRequestSchema>

export const UnassignTaskRequestSchema = z.object({
    project_member_id: z.string(),
})

export type UnassignTaskRequest = z.infer<typeof UnassignTaskRequestSchema>

export const MoveTaskRequestSchema = z.object({
    position: z.number(),
})

export type MoveTaskRequest = z.infer<typeof MoveTaskRequestSchema>
