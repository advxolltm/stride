import {
    applyProjectMembers,
    applyProjectSkill,
    removeProjectMemberByIdOrUserId,
    removeProjectSkillById,
} from '../features/project/project.cache'
import { projectApi } from '../features/project/project.api'
import {
    transformProjectMember,
    transformProject,
    transformProjectSkill,
} from '../features/project/project.mappers'
import {
    ApiProjectMemberListSchema,
    ApiProjectMemberSchema,
    ApiProjectSchema,
    ApiProjectSkillSchema,
} from '../features/project/project.types'
import type {
    Project,
    ProjectMember,
    ProjectSkill,
} from '../features/project/project.types'
import { WSMessageType } from '../features/realtime/realtime.types'
import type { WsListenerApi } from './wsTaskHandlers'
import { baseApi } from '../api/base.api'
import { z } from 'zod'

const ProjectMemberRemovePayloadSchema = z.object({
    project_member_id: z.string().optional(),
    projectMemberId: z.string().optional(),
    member_id: z.string().optional(),
    memberId: z.string().optional(),
    user_id: z.string().optional(),
    userId: z.string().optional(),
})

const ProjectSkillRemovePayloadSchema = z.object({
    project_skill_id: z.string().optional(),
    projectSkillId: z.string().optional(),
    skill_id: z.string().optional(),
    skillId: z.string().optional(),
    id: z.string().optional(),
})

const ProjectDeletePayloadSchema = z.object({
    project_id: z.string().optional(),
    projectId: z.string().optional(),
    id: z.string().optional(),
})

const patchProjectCaches = (
    api: WsListenerApi,
    projectId: string,
    apply: (project: Project) => void,
) => {
    api.dispatch(
        projectApi.util.updateQueryData(
            'getProjectById',
            projectId,
            (draft) => {
                apply(draft)
            },
        ),
    )
    api.dispatch(
        projectApi.util.updateQueryData('getProjects', undefined, (draft) => {
            const project = draft.find((item) => item.id === projectId)
            if (project) apply(project)
        }),
    )
}

const patchAddedMembers = (
    api: WsListenerApi,
    projectId: string,
    members: ProjectMember[],
) => {
    api.dispatch(
        projectApi.util.updateQueryData(
            'getProjectMembers',
            projectId,
            (draft) => {
                for (const member of members) {
                    const existingIndex = draft.findIndex(
                        (item) =>
                            item.id === member.id ||
                            item.userId === member.userId,
                    )

                    if (existingIndex === -1) {
                        draft.push(member)
                    } else {
                        draft[existingIndex] = member
                    }
                }
            },
        ),
    )
    patchProjectCaches(api, projectId, (project) => {
        applyProjectMembers(project, members)
    })
}

const patchProjectSkillCaches = (
    api: WsListenerApi,
    projectId: string,
    skill: ProjectSkill,
) => {
    api.dispatch(
        projectApi.util.updateQueryData(
            'getProjectSkills',
            projectId,
            (draft) => {
                const existingIndex = draft.findIndex(
                    (item) => item.id === skill.id,
                )

                if (existingIndex === -1) {
                    draft.push(skill)
                } else {
                    draft[existingIndex] = skill
                }
            },
        ),
    )
    patchProjectCaches(api, projectId, (project) => {
        applyProjectSkill(project, skill)
    })
}

const removeProjectSkillFromCaches = (
    api: WsListenerApi,
    projectId: string,
    skillId: string,
) => {
    api.dispatch(
        projectApi.util.updateQueryData(
            'getProjectSkills',
            projectId,
            (draft) => draft.filter((skill) => skill.id !== skillId),
        ),
    )
    patchProjectCaches(api, projectId, (project) => {
        removeProjectSkillById(project, skillId)
    })
}

const patchProjectSnapshot = (api: WsListenerApi, project: Project) => {
    api.dispatch(
        projectApi.util.upsertQueryData('getProjectById', project.id, project),
    )
    api.dispatch(
        projectApi.util.updateQueryData('getProjects', undefined, (draft) => {
            const existingProjectIndex = draft.findIndex(
                (item) => item.id === project.id,
            )

            if (existingProjectIndex === -1) {
                draft.push(project)
                return
            }

            draft[existingProjectIndex] = project
        }),
    )
}

const getDeletedProjectId = (payload: unknown) => {
    const project = ApiProjectSchema.safeParse(payload)
    if (project.success) {
        return project.data.id
    }

    const deletePayload = ProjectDeletePayloadSchema.safeParse(payload)
    if (!deletePayload.success) {
        return undefined
    }
    return (
        deletePayload.data.project_id ??
        deletePayload.data.projectId ??
        deletePayload.data.id
    )
}

const removeProjectFromCaches = (api: WsListenerApi, projectId: string) => {
    api.dispatch(
        projectApi.util.updateQueryData('getProjects', undefined, (draft) =>
            draft.filter((project) => project.id !== projectId),
        ),
    )
    api.dispatch(
        baseApi.util.invalidateTags([
            { type: 'Project', id: projectId },
            { type: 'ProjectMember', id: projectId },
            { type: 'ProjectSkill', id: projectId },
            { type: 'Task', id: projectId },
            { type: 'Messages', id: projectId },
            { type: 'Whiteboard', id: projectId },
            { type: 'WhiteboardElement', id: projectId },
        ]),
    )
}

const getRemovedMemberId = (payload: unknown) => {
    const projectMember = ApiProjectMemberSchema.safeParse(payload)
    if (projectMember.success) {
        return projectMember.data.user_id
    }

    const removePayload = ProjectMemberRemovePayloadSchema.safeParse(payload)
    if (!removePayload.success) {
        return undefined
    }
    return (
        removePayload.data.project_member_id ??
        removePayload.data.projectMemberId ??
        removePayload.data.member_id ??
        removePayload.data.memberId ??
        removePayload.data.user_id ??
        removePayload.data.userId
    )
}

const getRemovedSkillId = (payload: unknown) => {
    const projectSkill = ApiProjectSkillSchema.safeParse(payload)
    if (projectSkill.success) {
        return projectSkill.data.id
    }

    const removePayload = ProjectSkillRemovePayloadSchema.safeParse(payload)
    if (!removePayload.success) {
        return undefined
    }
    return (
        removePayload.data.project_skill_id ??
        removePayload.data.projectSkillId ??
        removePayload.data.skill_id ??
        removePayload.data.skillId ??
        removePayload.data.id
    )
}

export function handleProjectWsMessage(
    type: number,
    payload: unknown,
    projectId: string,
    api: WsListenerApi,
) {
    switch (type) {
        case WSMessageType.ChatMessageCreate:
        case WSMessageType.ChatMessageUpdate:
        case WSMessageType.ChatMessageDelete: {
            console.log(type, payload)
            api.dispatch(baseApi.util.invalidateTags([{ type: 'Messages' }]))
            return true
        }
        case WSMessageType.ProjectMemberAdd: {
            const parsedList = ApiProjectMemberListSchema.safeParse(payload)
            let apiMembers: ProjectMember[] | undefined

            if (parsedList.success) {
                apiMembers = parsedList.data.map(transformProjectMember)
            } else {
                const parsedSingle = ApiProjectMemberSchema.safeParse(payload)
                if (!parsedSingle.success) {
                    return true
                }
                apiMembers = [transformProjectMember(parsedSingle.data)]
            }

            patchAddedMembers(api, projectId, apiMembers)
            return true
        }
        case WSMessageType.ProjectMemberRemove: {
            const memberId = getRemovedMemberId(payload)

            if (!memberId) {
                return true
            }

            api.dispatch(
                projectApi.util.updateQueryData(
                    'getProjectMembers',
                    projectId,
                    (draft) =>
                        draft.filter(
                            (member) =>
                                member.id !== memberId &&
                                member.userId !== memberId,
                        ),
                ),
            )
            patchProjectCaches(api, projectId, (project) => {
                removeProjectMemberByIdOrUserId(project, memberId)
            })
            return true
        }
        case WSMessageType.ProjectSkillAdd: {
            const parsedPayload = ApiProjectSkillSchema.safeParse(payload)
            if (!parsedPayload.success) {
                return true
            }

            patchProjectSkillCaches(
                api,
                projectId,
                transformProjectSkill(parsedPayload.data),
            )
            return true
        }
        case WSMessageType.ProjectSkillRemove: {
            const skillId = getRemovedSkillId(payload)

            if (!skillId) {
                return true
            }

            removeProjectSkillFromCaches(api, projectId, skillId)
            return true
        }
        case WSMessageType.ProjectUpdate: {
            const parsedPayload = ApiProjectSchema.safeParse(payload)
            if (!parsedPayload.success) {
                return true
            }

            patchProjectSnapshot(api, transformProject(parsedPayload.data))
            return true
        }
        case WSMessageType.ProjectDelete: {
            const deletedProjectId = getDeletedProjectId(payload) ?? projectId
            removeProjectFromCaches(api, deletedProjectId)
            return true
        }
        default:
            return false
    }
}
