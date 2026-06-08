import type { User } from '../../../shared/types'
import { baseApi } from '../../api/base.api'
import type { AppDispatch, RootState } from '../../store'
import { patchUserIdentityInCaches } from './user.cache'
import {
    mapApiUserSkillToUserSkill,
    mapApiUserToUser,
} from './user.mappers'
import type {
    ChangePasswordRequest,
    CreateUserRequest,
    UpdateUserRequest,
    UpdateUserProjectSkillsRequest,
    UserSkill,
} from './user.types'
import {
    ApiUserListSchema,
    ApiUserSchema,
    ApiUserSkillListSchema,
} from './user.types'

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
            invalidatesTags: (_result, _error, id) => [{ type: 'User', id }],
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
    }),
})

export const {
    useGetUsersQuery,
    useGetUserByIdQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useChangePasswordMutation,
    useDeleteUserMutation,
    useGetMyUserSkillsQuery,
    useUpdateUserProjectSkillsMutation,
} = userApi
