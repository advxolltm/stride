import { baseApi } from '../api/base.api'
import {
    applyProjectMembers,
    removeProjectMemberByIdOrUserId,
} from '../features/project/project.cache'
import { projectApi } from '../features/project/project.api'
import { transformProjectMember } from '../features/project/project.mappers'
import type {
    ApiProjectMember,
    Project,
    ProjectMember,
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

const invalidateProjectMembers = (api: WsListenerApi, projectId: string) => {
    api.dispatch(
        baseApi.util.invalidateTags([
            { type: 'ProjectMember', id: projectId },
            { type: 'Project', id: projectId },
            { type: 'Project', id: 'LIST' },
        ]),
    )
}

const patchProjectMemberCaches = (
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
    patchProjectMemberCaches(api, projectId, (project) => {
        applyProjectMembers(project, members)
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
                invalidateProjectMembers(api, projectId)
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
                invalidateProjectMembers(api, projectId)
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
            patchProjectMemberCaches(api, projectId, (project) => {
                removeProjectMemberByIdOrUserId(project, memberId)
            })
            return true
        }
        default:
            return false
    }
}
