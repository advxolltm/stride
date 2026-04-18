import { baseApi } from '../../api/baseApi'
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
        }),
    }),
})

export const { useLoginMutation } = authApi
