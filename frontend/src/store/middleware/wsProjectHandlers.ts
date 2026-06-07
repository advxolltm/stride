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
import type {
    ApiProject,
    ApiProjectMember,
    ApiProjectSkill,
    Project,
    ProjectMember,
    ProjectSkill,
} from '../features/project/project.types'
import { WSMessageType } from '../features/realtime/realtime.types'
import type { WsListenerApi } from './wsTaskHandlers'
import { baseApi } from '../api/base.api'

type ProjectMemberRemovePayload = {
    project_member_id?: string
    projectMemberId?: string
    member_id?: string
    memberId?: string
    user_id?: string
    userId?: string
}

type ProjectSkillRemovePayload = {
    project_skill_id?: string
    projectSkillId?: string
    skill_id?: string
    skillId?: string
    id?: string
}

type ProjectDeletePayload = {
    project_id?: string
    projectId?: string
    id?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isApiProjectUser = (value: unknown) =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.username === 'string' &&
    typeof value.email === 'string'

const isApiProjectMember = (value: unknown): value is ApiProjectMember =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.project_id === 'string' &&
    typeof value.role === 'string' &&
    typeof value.joined_at === 'string' &&
    isApiProjectUser(value.user)

const isApiProjectSkill = (value: unknown): value is ApiProjectSkill =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.project_id === 'string' &&
    typeof value.name === 'string'

const isApiProject = (value: unknown): value is ApiProject =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    (typeof value.created_by === 'string' || value.created_by === null) &&
    typeof value.name === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.description === 'string' &&
    typeof value.status === 'string' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    (typeof value.join_link === 'string' || value.join_link === null) &&
    isApiProjectUser(value.creator) &&
    Array.isArray(value.members) &&
    value.members.every(isApiProjectMember) &&
    Array.isArray(value.skills) &&
    value.skills.every(isApiProjectSkill)

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
    if (isApiProject(payload)) {
        return payload.id
    }

    const deletePayload = payload as ProjectDeletePayload
    return (
        deletePayload.project_id ?? deletePayload.projectId ?? deletePayload.id
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
    if (isApiProjectMember(payload)) {
        return payload.user_id
    }

    const removePayload = payload as ProjectMemberRemovePayload
    return (
        removePayload.project_member_id ??
        removePayload.projectMemberId ??
        removePayload.member_id ??
        removePayload.memberId ??
        removePayload.user_id ??
        removePayload.userId
    )
}

const getRemovedSkillId = (payload: unknown) => {
    if (isApiProjectSkill(payload)) {
        return payload.id
    }

    const removePayload = payload as ProjectSkillRemovePayload
    return (
        removePayload.project_skill_id ??
        removePayload.projectSkillId ??
        removePayload.skill_id ??
        removePayload.skillId ??
        removePayload.id
    )
}

export function handleProjectWsMessage(
    type: number,
    payload: unknown,
    projectId: string,
    api: WsListenerApi,
) {
    switch (type) {
        case WSMessageType.ProjectMemberAdd: {
            const apiMembers = Array.isArray(payload) ? payload : [payload]

            if (!apiMembers.every(isApiProjectMember)) {
                return true
            }

            patchAddedMembers(
                api,
                projectId,
                apiMembers.map(transformProjectMember),
            )
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
            if (!isApiProjectSkill(payload)) {
                return true
            }

            patchProjectSkillCaches(
                api,
                projectId,
                transformProjectSkill(payload),
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
            if (!isApiProject(payload)) {
                return true
            }

            patchProjectSnapshot(api, transformProject(payload))
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
