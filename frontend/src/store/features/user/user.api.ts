import type { User } from '../../../shared/types'
import { baseApi } from '../../api/base.api'
import { projectApi } from '../project/project.api'
import { applyProjectMember } from '../project/project.cache'
import { transformProjectMember } from '../project/project.mappers'
import { ApiProjectMemberSchema, type Project } from '../project/project.types'
import type { AppDispatch, RootState } from '../../store'
import { patchUserIdentityInCaches } from './user.cache'
import { mapApiUserSkillToUserSkill, mapApiUserToUser } from './user.mappers'
import type {
    ChangePasswordRequest,
    CreateUserRequest,
    ResetPasswordRequest,
    SetAllWorkingHoursRequest,
    SetProjectWorkingHoursRequest,
    UpdateUserRequest,
    UpdateUserProjectSkillsRequest,
    UserSkill,
} from './user.types'
import {
    ApiUserListSchema,
    ApiUserSchema,
    ApiUserSkillListSchema,
} from './user.types'

const patchWorkingHoursInProject = (
    project: Project,
    userId: string,
    projectId: string,
    workingHours: number,
) => {
    if (project.id !== projectId) {
        return
    }

    const member = project.members.find((item) => item.userId === userId)
    if (member) {
        member.workingHours = workingHours
    }
}

export const userApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getUsers: builder.query<User[], void>({
            query: () => '/users',
            transformResponse: (response: unknown) =>
                ApiUserListSchema.parse(response).map(mapApiUserToUser),
            providesTags: ['User'],
        }),

        getUserById: builder.query<User, string>({
            query: (id) => `/users/${id}`,
            transformResponse: (response: unknown) =>
                mapApiUserToUser(ApiUserSchema.parse(response)),
            providesTags: (_result, _error, id) => [{ type: 'User', id }],
        }),

        createUser: builder.mutation<User, CreateUserRequest>({
            query: (body) => ({ url: '/users', method: 'POST', body }),
            transformResponse: (response: unknown) =>
                mapApiUserToUser(ApiUserSchema.parse(response)),
            invalidatesTags: ['User'],
        }),

        updateUser: builder.mutation<
            User,
            { id: string; body: UpdateUserRequest | FormData }
        >({
            query: ({ id, body }) => ({
                url: `/users/${id}`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (response: unknown) =>
                mapApiUserToUser(ApiUserSchema.parse(response)),
            async onQueryStarted(_arg, lifecycleApi) {
                try {
                    const { data } = await lifecycleApi.queryFulfilled
                    patchUserIdentityInCaches(data, {
                        dispatch: lifecycleApi.dispatch as AppDispatch,
                        state: lifecycleApi.getState() as RootState,
                        userApiUtil: userApi.util,
                    })
                } catch {
                    // The hook that called this mutation will surface the error.
                }
            },
            invalidatesTags: (_result, _error, { id }) => [
                'User',
                { type: 'User', id },
            ],
        }),

        changePassword: builder.mutation<
            void,
            { id: string; body: ChangePasswordRequest }
        >({
            query: ({ id, body }) => ({
                url: `/users/${id}/password`,
                method: 'PATCH',
                body,
            }),
        }),

        deleteUser: builder.mutation<void, string>({
            query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
            invalidatesTags: (_result, _error, id) => [
                'User',
                { type: 'User', id },
            ],
        }),

        resetUserPassword: builder.mutation<
            void,
            { id: string; body: ResetPasswordRequest }
        >({
            query: ({ id, body }) => ({
                url: `/users/${id}/password/reset`,
                method: 'PATCH',
                body,
            }),
        }),

        getMyUserSkills: builder.query<UserSkill[], string>({
            query: (id) => `/users/${id}/skills`,
            transformResponse: (response: unknown) =>
                ApiUserSkillListSchema.parse(response).map(
                    mapApiUserSkillToUserSkill,
                ),
            providesTags: (_result, _error, id) => [{ type: 'UserSkill', id }],
        }),

        updateUserProjectSkills: builder.mutation<
            UserSkill[],
            {
                userId: string
                projectId: string
                body: UpdateUserProjectSkillsRequest
            }
        >({
            query: ({ userId, projectId, body }) => ({
                url: `/users/${userId}/projects/${projectId}/skills`,
                method: 'PUT',
                body,
            }),
            transformResponse: (response: unknown) =>
                ApiUserSkillListSchema.parse(response).map(
                    mapApiUserSkillToUserSkill,
                ),
            async onQueryStarted({ userId }, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled
                    dispatch(
                        userApi.util.updateQueryData(
                            'getMyUserSkills',
                            userId,
                            () => data,
                        ),
                    )
                } catch {
                    // The hook that called this mutation will surface the error.
                }
            },
        }),

        setProjectWorkingHours: builder.mutation<
            import('../project/project.types').ProjectMember,
            {
                userId: string
                projectId: string
                body: SetProjectWorkingHoursRequest
            }
        >({
            query: ({ userId, projectId, body }) => ({
                url: `/users/${userId}/projects/${projectId}/working-hours`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (response: unknown) =>
                transformProjectMember(ApiProjectMemberSchema.parse(response)),
            async onQueryStarted(
                { projectId },
                { dispatch, queryFulfilled },
            ) {
                try {
                    const { data } = await queryFulfilled

                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjectMembers',
                            projectId,
                            (draft) => {
                                const index = draft.findIndex(
                                    (member) =>
                                        member.id === data.id ||
                                        member.userId === data.userId,
                                )

                                if (index === -1) {
                                    draft.push(data)
                                } else {
                                    draft[index] = data
                                }
                            },
                        ),
                    )
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjectById',
                            projectId,
                            (draft) => {
                                applyProjectMember(draft, data)
                            },
                        ),
                    )
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjects',
                            undefined,
                            (draft) => {
                                const project = draft.find(
                                    (item) => item.id === projectId,
                                )
                                if (project) {
                                    applyProjectMember(project, data)
                                }
                            },
                        ),
                    )
                } catch {
                    // The hook that called this mutation will surface the error.
                }
            },
        }),

        setAllWorkingHours: builder.mutation<
            void,
            { userId: string; body: SetAllWorkingHoursRequest }
        >({
            query: ({ userId, body }) => ({
                url: `/users/${userId}/projects/working-hours`,
                method: 'POST',
                body,
            }),
            async onQueryStarted(
                { userId, body },
                { dispatch, queryFulfilled },
            ) {
                try {
                    await queryFulfilled

                    for (const entry of body) {
                        dispatch(
                            projectApi.util.updateQueryData(
                                'getProjectMembers',
                                entry.project_id,
                                (draft) => {
                                    const member = draft.find(
                                        (item) => item.userId === userId,
                                    )
                                    if (member) {
                                        member.workingHours =
                                            entry.working_hours
                                    }
                                },
                            ),
                        )
                        dispatch(
                            projectApi.util.updateQueryData(
                                'getProjectById',
                                entry.project_id,
                                (draft) => {
                                    patchWorkingHoursInProject(
                                        draft,
                                        userId,
                                        entry.project_id,
                                        entry.working_hours,
                                    )
                                },
                            ),
                        )
                        dispatch(
                            projectApi.util.updateQueryData(
                                'getProjects',
                                undefined,
                                (draft) => {
                                    const project = draft.find(
                                        (item) => item.id === entry.project_id,
                                    )
                                    if (project) {
                                        patchWorkingHoursInProject(
                                            project,
                                            userId,
                                            entry.project_id,
                                            entry.working_hours,
                                        )
                                    }
                                },
                            ),
                        )
                    }
                } catch {
                    // The hook that called this mutation will surface the error.
                }
            },
        }),
    }),
})

export const {
    useGetUsersQuery,
    useGetUserByIdQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useChangePasswordMutation,
    useDeleteUserMutation,
    useResetUserPasswordMutation,
    useGetMyUserSkillsQuery,
    useUpdateUserProjectSkillsMutation,
    useSetProjectWorkingHoursMutation,
    useSetAllWorkingHoursMutation,
} = userApi
