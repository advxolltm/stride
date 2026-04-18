import type { User } from '../../../shared/types';
import { baseApi } from '../../api/base.api';
import type {
    ApiUser,
    CreateUserRequest,
    UpdateUserRequest,
} from './user.types';

// ─── Mapper ──────────────────────────────────────────────────────────────────

const mapApiUserToUser = ({
    ID,
    Username,
    Email,
    FullName,
    AvatarURL,
    CreatedAt,
    UpdatedAt,
}: ApiUser): User => ({
    id: ID,
    username: Username,
    email: Email,
    fullName: FullName,
    avatarUrl: AvatarURL,
    createdAt: CreatedAt,
    updatedAt: UpdatedAt,
})

// ─── Endpoints ───────────────────────────────────────────────────────────────

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
            { id: string; body: UpdateUserRequest }
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
