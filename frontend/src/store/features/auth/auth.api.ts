import { baseApi } from '../../api/base.api'
import type { User } from '../../../shared/types/user'
import type { ApiUser } from '../user/user.types'
import type { LoginRequest } from './auth.types'

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

export const authApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getMe: builder.query<User, void>({
            query: () => ({
                url: '/auth/me',
                method: 'GET',
            }),
            transformResponse: (response: ApiUser) => mapApiUserToUser(response),
            providesTags: ['Auth'],
        }),
        login: builder.mutation<void, LoginRequest>({
            query: ({ email, password }) => {
                const body = new URLSearchParams()
                body.set('email', email)
                body.set('password', password)

                return {
                    url: '/auth/login',
                    method: 'POST',
                    body,
                }
            },
            invalidatesTags: ['Auth'],
        }),
        logout: builder.mutation<void, void>({
            query: () => ({
                url: '/auth/logout',
                method: 'POST',
            }),
            invalidatesTags: ['Auth'],
        }),
    }),
})

export const { useGetMeQuery, useLoginMutation, useLogoutMutation } = authApi
