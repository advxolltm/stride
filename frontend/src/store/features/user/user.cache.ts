import type { User } from '../../../shared/types'
import type { AppDispatch, RootState } from '../../store'
import { projectApi } from '../project/project.api'
import { taskApi } from '../tasks/task.api'
import type { userApi } from './user.api'

type UserApiUtil = typeof userApi.util

type CachePatchApi = {
    dispatch: AppDispatch
    state: RootState
    userApiUtil: UserApiUtil
}

const patchUserIdentity = <TUser extends Pick<User, 'id'>>(
    user: TUser,
    updatedUser: User,
) => {
    if (user.id !== updatedUser.id) {
        return;
    }

    Object.assign(user, {
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        avatarUrl: updatedUser.avatarUrl,
        avatarSmallUrl: updatedUser.avatarSmallUrl,
    })
}

export const patchUserIdentityInCaches = (
    updatedUser: User,
    { dispatch, state, userApiUtil }: CachePatchApi,
) => {
    dispatch(
        userApiUtil.updateQueryData('getUsers', undefined, (draft) => {
            const user = draft.find((item) => item.id === updatedUser.id)
            if (user) patchUserIdentity(user, updatedUser)
        }),
    )
    dispatch(
        userApiUtil.updateQueryData('getUserById', updatedUser.id, (draft) => {
            patchUserIdentity(draft, updatedUser)
        }),
    )

    dispatch(
        projectApi.util.updateQueryData('getProjects', undefined, (draft) => {
            for (const project of draft) {
                patchUserIdentity(project.creator, updatedUser)
                for (const member of project.members) {
                    patchUserIdentity(member.user, updatedUser)
                }
            }
        }),
    )

    for (const projectId of projectApi.util.selectCachedArgsForQuery(
        state,
        'getProjectById',
    )) {
        dispatch(
            projectApi.util.updateQueryData(
                'getProjectById',
                projectId,
                (draft) => {
                    patchUserIdentity(draft.creator, updatedUser)
                    for (const member of draft.members) {
                        patchUserIdentity(member.user, updatedUser)
                    }
                },
            ),
        )
    }

    for (const projectId of projectApi.util.selectCachedArgsForQuery(
        state,
        'getProjectMembers',
    )) {
        dispatch(
            projectApi.util.updateQueryData(
                'getProjectMembers',
                projectId,
                (draft) => {
                    for (const member of draft) {
                        patchUserIdentity(member.user, updatedUser)
                    }
                },
            ),
        )
    }

    for (const projectId of taskApi.util.selectCachedArgsForQuery(
        state,
        'getTasksForProject',
    )) {
        dispatch(
            taskApi.util.updateQueryData(
                'getTasksForProject',
                projectId,
                (draft) => {
                    for (const task of draft) {
                        for (const assignee of task.assignees ?? []) {
                            patchUserIdentity(assignee.user, updatedUser)
                        }
                    }
                },
            ),
        )
    }

    for (const taskId of taskApi.util.selectCachedArgsForQuery(
        state,
        'getTask',
    )) {
        dispatch(
            taskApi.util.updateQueryData('getTask', taskId, (draft) => {
                for (const assignee of draft.assignees ?? []) {
                    patchUserIdentity(assignee.user, updatedUser)
                }
            }),
        )
    }
}
