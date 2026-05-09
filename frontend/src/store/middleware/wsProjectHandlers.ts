import {
    applyProjectMembers,
    applyProjectSkill,
    removeProjectMemberByIdOrUserId,
    removeProjectSkillById,
} from '../features/project/project.cache'
import { projectApi } from '../features/project/project.api'
import {
    transformProjectMember,
    transformProjectSkill,
} from '../features/project/project.mappers'
import type {
    ApiProjectMember,
    ApiProjectSkill,
    Project,
    ProjectMember,
    ProjectSkill,
} from '../features/project/project.types'
import { WSMessageType } from '../features/projectSocket/projectSocket.types'
import type { WsListenerApi } from './wsTaskHandlers'

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
        default:
            return false
    }
}
