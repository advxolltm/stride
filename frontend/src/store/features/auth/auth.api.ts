import type { User } from '../../../shared/types'
import { baseApi } from '../../api/base.api'
import type { LoginRequest } from './auth.types'

export const authApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
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

        getSession: builder.query<User, void>({
            query: () => ({
                url: '/auth/session',
                method: 'GET',
                credentials: 'include',
            }),
            providesTags: ['Auth'],
        }),
    }),
})

export const { useLoginMutation, useLogoutMutation, useGetSessionQuery } =
    authApi
