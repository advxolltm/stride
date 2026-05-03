import type {
    Project,
    ProjectMember,
    ProjectSkill,
    UpdateProjectRequest,
} from './project.types'

export const patchProject = (project: Project, updatedProject: Project) => {
    Object.assign(project, updatedProject)
}

// List cards do not need every nested relation replaced after a simple project edit.
export const patchProjectFields = (
    project: Project,
    updatedProject: Project,
) => {
    project.name = updatedProject.name
    project.slug = updatedProject.slug
    project.description = updatedProject.description
    project.status = updatedProject.status
    project.updatedAt = updatedProject.updatedAt
    project.joinLink = updatedProject.joinLink
}

// Used for the optimistic edit before the backend sends the final project back.
export const applyProjectUpdate = (
    project: Project,
    update: UpdateProjectRequest,
) => {
    project.name = update.name

    if ('description' in update) {
        project.description = update.description ?? ''
    }
    if ('status' in update && update.status) {
        project.status = update.status
    }
}

// Add/update members by user too, because the same user should only appear once.
export const applyProjectMembers = (
    project: Project,
    members: ProjectMember[],
) => {
    project.members ??= []

    for (const member of members) {
        const existingIndex = project.members.findIndex(
            (item) => item.id === member.id || item.userId === member.userId,
        )

        if (existingIndex === -1) {
            project.members.push(member)
        } else {
            project.members[existingIndex] = member
        }
    }
}

// The remove-member endpoint uses the user id in the URL, not the member row id.
export const removeProjectMemberByUserId = (
    project: Project,
    userId: string,
) => {
    project.members =
        project.members?.filter((member) => member.userId !== userId) ?? []
}

export const removeProjectMemberByIdOrUserId = (
    project: Project,
    memberIdOrUserId: string,
) => {
    project.members =
        project.members?.filter(
            (member) =>
                member.id !== memberIdOrUserId &&
                member.userId !== memberIdOrUserId,
        ) ?? []
}

// Skill creation returns the full skill, so we can add or replace it directly.
export const applyProjectSkill = (project: Project, skill: ProjectSkill) => {
    project.skills ??= []

    const existingIndex = project.skills.findIndex(
        (item) => item.id === skill.id,
    )

    if (existingIndex === -1) {
        project.skills.push(skill)
        return
    }

    project.skills[existingIndex] = skill
}

export const removeProjectSkillById = (project: Project, skillId: string) => {
    project.skills =
        project.skills?.filter((skill) => skill.id !== skillId) ?? []
}
