export type ApiProjectMember = {
    ID: string
    UserID: string
    ProjectID: string
    Role: 'owner' | 'member'
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
    initials: string
    members: ApiProjectMember[]
    skills: ApiProjectSkill[]
}

export type CreateProjectRequest = {
    name: string
    slug: string
    description: string
    status: 'active' | 'archived'
}

export type CreateProjectSkillRequest = {
    name: string
    description: string | null
}
