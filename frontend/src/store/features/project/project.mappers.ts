import type {
    ApiProject,
    ApiProjectMember,
    ApiProjectSkill,
    ApiProjectUser,
    Project,
    ProjectMember,
    ProjectSkill,
    ProjectUser,
} from './project.types'

// Keep API snake_case out of components and cache helpers.
export const transformApiUser = (user: ApiProjectUser): ProjectUser => ({
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    avatarUrl: user.avatar_url?.original ?? null,
    avatarSmallUrl: user.avatar_url?.[300] ?? user.avatar_url?.original ?? null,
})

export const transformProjectSkill = (
    skill: ApiProjectSkill,
): ProjectSkill => ({
    id: skill.id,
    projectId: skill.project_id,
    name: skill.name,
    description: skill.description,
})

export const transformProjectMember = (
    member: ApiProjectMember,
): ProjectMember => ({
    id: member.id,
    userId: member.user_id,
    projectId: member.project_id,
    role: member.role,
    joinedAt: member.joined_at,
    user: transformApiUser(member.user),
})

export const transformProject = (project: ApiProject): Project => ({
    id: project.id,
    createdBy: project.created_by,
    name: project.name,
    slug: project.slug,
    description: project.description,
    status: project.status,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    joinLink: project.join_link,
    creator: transformApiUser(project.creator),
    members: project.members?.map(transformProjectMember) ?? [],
    skills: project.skills?.map(transformProjectSkill) ?? [],
})
