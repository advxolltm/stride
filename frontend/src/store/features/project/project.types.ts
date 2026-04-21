import type { User } from '../../../shared/types'
import type { ApiUser } from '../user/user.types'

export type ApiProjectMember = {
    ID: string
    UserID: string
    ProjectID: string
    Role: 'owner' | 'member'
    JoinedAt: string
    User: ApiUser
}

export type ApiProjectSkill = {
    ID: string
    ProjectID: string
    Name: string
    Description: string | null
}

export type ApiProject = {
    ID: string
    CreatedBy: string | null
    Name: string
    Slug: string
    Description: string | null
    Status: string
    CreatedAt: string
    UpdatedAt: string
    JoinLink: string | null
    Members?: ApiProjectMember[] | null
    Skills?: ApiProjectSkill[] | null
}

export type ProjectMember = {
    id: string
    userId: string
    projectId: string
    role: 'owner' | 'member'
    joinedAt: string
    user: User
}

export type ProjectSkill = {
    id: string
    projectId: string
    name: string
    description: string | null
}

export type Project = {
    id: string
    createdBy: string | null
    name: string
    slug: string
    description: string
    status: string
    createdAt: string
    updatedAt: string
    joinLink: string | null
    members: ProjectMember[]
    skills: ProjectSkill[]
}

export type CreateProjectRequest = {
    name: string
    slug: string
    description: string
    status: 'active' | 'archived'
}

export type UpdateProjectRequest = {
    name: string
    description?: string
    status?: 'active' | 'archived'
}

export type CreateProjectSkillRequest = {
    name: string
    description: string | null
}

export type AddProjectMemberRequest = {
    userid: string
    role: 'owner' | 'member'
}
