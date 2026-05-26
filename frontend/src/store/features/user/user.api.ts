import type { User } from '../../../shared/types'
import { baseApi } from '../../api/base.api'
import type { AppDispatch, RootState } from '../../store'
import { patchUserIdentityInCaches } from './user.cache'
import type {
    ApiUser,
    ApiUserSkill,
    ChangePasswordRequest,
    CreateUserRequest,
    ResetPasswordRequest,
    UpdateUserRequest,
    UpdateUserProjectSkillsRequest,
    UserSkill,
} from './user.types'

export const mapApiUserToUser = ({
    id,
    username,
    email,
    full_name,
    avatar_url,
    is_superuser,
}: ApiUser): User => ({
    id,
    username,
    email,
    fullName: full_name,
    avatarUrl: avatar_url?.original ?? null,
    avatarSmallUrl: avatar_url?.[300] ?? avatar_url?.original ?? null,
    isSuperuser: is_superuser,
})

export const mapApiUserSkillToUserSkill = ({
    id,
    user_id,
    project_skill_id,
    project_skill,
}: ApiUserSkill): UserSkill => ({
    id,
    userId: user_id,
    projectSkillId: project_skill_id,
    projectSkill: {
        id: project_skill.id,
        projectId: project_skill.project_id,
        name: project_skill.name,
        description: project_skill.description,
    },
})

export const userApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getUsers: builder.query<User[], void>({
            query: () => '/users',
            transformResponse: (response: ApiUser[]) =>
                response.map(mapApiUserToUser),
            providesTags: ['User'],
        }),

        getUserById: builder.query<User, string>({
            query: (id) => `/users/${id}`,
            transformResponse: (response: ApiUser) =>
                mapApiUserToUser(response),
            providesTags: (_result, _error, id) => [{ type: 'User', id }],
        }),

        createUser: builder.mutation<User, CreateUserRequest>({
            query: (body) => ({ url: '/users', method: 'POST', body }),
            transformResponse: (response: ApiUser) =>
                mapApiUserToUser(response),
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
            transformResponse: (response: ApiUser) =>
                mapApiUserToUser(response),
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
            transformResponse: (response: ApiUserSkill[]) =>
                response.map(mapApiUserSkillToUserSkill),
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
            transformResponse: (response: ApiUserSkill[]) =>
                response.map(mapApiUserSkillToUserSkill),
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
} = userApi
