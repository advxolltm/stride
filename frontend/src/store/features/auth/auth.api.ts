import { UserSchema, type User } from '../../../shared/types'
import { baseApi } from '../../api/base.api'
import { clearUserId, setUserId } from '../../userSlice'
import { mapApiUserToUser } from '../user/user.mappers'
import { ApiUserSchema } from '../user/user.types'
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
            async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
                try {
                    await queryFulfilled
                    dispatch(clearUserId())
                } catch {
                    // Keep the current id if the logout request fails.
                }
            },
            invalidatesTags: ['Auth'],
        }),

        getSession: builder.query<User, void>({
            query: () => ({
                url: '/auth/session',
                method: 'GET',
                credentials: 'include',
            }),
            transformResponse: (response: unknown) =>
                UserSchema.parse(mapApiUserToUser(ApiUserSchema.parse(response))),
            async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled
                    dispatch(setUserId(data.id))
                } catch {
                    dispatch(clearUserId())
                }
            },
            providesTags: ['Auth'],
        }),
    }),
})

export const { useLoginMutation, useLogoutMutation, useGetSessionQuery } =
    authApi
