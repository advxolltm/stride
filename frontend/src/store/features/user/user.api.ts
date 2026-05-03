import type { User } from '../../../shared/types'
import { baseApi } from '../../api/base.api'
import type {
    ApiUser,
    CreateUserRequest,
    UpdateUserRequest,
} from './user.types'

export const mapApiUserToUser = ({
    id,
    username,
    email,
    full_name,
    avatar_url,
}: ApiUser): User => ({
    id,
    username,
    email,
    fullName: full_name,
    avatarUrl: avatar_url?.original ?? null,
    avatarSmallUrl: avatar_url?.[300] ?? avatar_url?.original ?? null,
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
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'User', id },
            ],
        }),

        deleteUser: builder.mutation<void, string>({
            query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
            invalidatesTags: (_result, _error, id) => [{ type: 'User', id }],
        }),
    }),
})

export const {
    useGetUsersQuery,
    useGetUserByIdQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useDeleteUserMutation,
} = userApi
