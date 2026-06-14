import type { ProjectMember, ProjectSkill } from '../project/project.types'
import type {
    ApiTask,
    ApiTaskAssignee,
    ApiTaskSkill,
    Task,
    TaskAssignee,
    TaskSkill,
} from './task.types'

// Backend assignees are nested and snake_case; the UI works with this flatter shape.
export const mapApiTaskAssigneeToAssignee = (
    assignee: ApiTaskAssignee,
): TaskAssignee => ({
    id: assignee.id,
    taskId: assignee.task_id,
    projectMemberId: assignee.project_member_id,
    assignedAt: assignee.assigned_at,
    user: {
        id: assignee.project_member.user.id,
        username: assignee.project_member.user.username,
        email: assignee.project_member.user.email,
        fullName: assignee.project_member.user.full_name,
        avatarUrl: assignee.project_member.user.avatar_url?.original ?? null,
        avatarSmallUrl:
            assignee.project_member.user.avatar_url?.['300'] ??
            assignee.project_member.user.avatar_url?.original ??
            null,
    },
})

// Skill chips only need the project skill id, name, and description.
export const mapApiTaskSkillToSkill = (skill: ApiTaskSkill): TaskSkill => ({
    id: skill.id,
    taskId: skill.task_id,
    projectSkillId: skill.project_skill_id,
    name: skill.project_skill.name,
    description: skill.project_skill.description,
})

// Keep the API response shape out of the components.
export const transformTask = (task: ApiTask): Task => ({
    id: task.id,
    projectId: task.project_id,
    createdBy: task.created_by,
    title: task.title,
    description: task.description,
    status: task.status as Task['status'],
    startDate: task.start_date,
    dueDate: task.due_date,
    expectedDurationHours: task.expected_duration_hours,
    position: task.position,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    completedAt: task.completed_at,
    assignees: task.task_assignees?.map(mapApiTaskAssigneeToAssignee) ?? [],
    skills: task.task_skills?.map(mapApiTaskSkillToSkill) ?? [],
})

// Used when assigning a task before the backend sends back the final assignment.
export const mapProjectMemberToTaskAssignee = (
    member: ProjectMember,
    taskId: string,
    assigneeId: string,
): TaskAssignee => ({
    id: assigneeId,
    taskId,
    projectMemberId: member.id,
    assignedAt: new Date().toISOString(),
    user: {
        id: member.user.id,
        username: member.user.username,
        email: member.user.email,
        fullName: member.user.fullName,
        avatarUrl: member.user.avatarUrl,
    },
})

// Used when adding a skill before the backend sends back a task-skill payload.
export const mapProjectSkillToTaskSkill = (
    skill: ProjectSkill,
    taskId: string,
    taskSkillId: string,
): TaskSkill => ({
    id: taskSkillId,
    taskId,
    projectSkillId: skill.id,
    name: skill.name,
    description: skill.description,
})
