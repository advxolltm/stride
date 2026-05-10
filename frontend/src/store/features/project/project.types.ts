export type ApiProjectMember = {
    id: string
    user_id: string
    project_id: string
    role: 'owner' | 'member'
    joined_at: string
    user: ApiProjectUser
}

export type ApiProjectUser = {
    id: string
    username: string
    email: string
    full_name: string | null
    avatar_url: string | null
}

export type ApiProjectSkill = {
    id: string
    project_id: string
    name: string
    description: string | null
}

export type ApiProject = {
    id: string
    created_by: string | null
    name: string
    slug: string
    description: string
    status: string
    created_at: string
    updated_at: string
    join_link: string | null
    creator: ApiProjectUser
    members: ApiProjectMember[]
    skills: ApiProjectSkill[]
}

export type ProjectMember = {
    id: string
    userId: string
    projectId: string
    role: 'owner' | 'member'
    joinedAt: string
    user: ProjectUser
}

export type ProjectSkill = {
    id: string
    projectId: string
    name: string
    description: string | null
}

export type Project = {
    id: string
    createdBy: string | null //TODO: Check if it was removed on the backend and remove it from here if so
    name: string
    slug: string
    description: string
    status: string
    createdAt: string
    updatedAt: string
    joinLink: string | null
    creator: ProjectUser
    members: ProjectMember[]
    skills: ProjectSkill[]
}

export type ProjectUser = {
    id: string
    username: string
    email: string
    fullName: string | null
    avatarUrl: string | null
}

export type CreateProjectRequest = {
    name: string
    slug: string
    description: string
    status: 'active' | 'archived'
}

export type UpdateProjectRequest = {
    name?: string
    description?: string
    status?: 'active' | 'archived'
}

export type CreateProjectSkillRequest = {
    name: string
    description: string | null
}

export type AddProjectMembersRequest = {
    userid: string
    role: 'owner' | 'member'
}[]
