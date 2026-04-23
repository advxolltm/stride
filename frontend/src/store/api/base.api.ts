import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const DEFAULT_API_BASE_PATH = '/api/v1'

const normalizeApiBasePath = (apiBasePath: string) => {
    const trimmed = apiBasePath.trim()
    if (!trimmed) {
        return DEFAULT_API_BASE_PATH
    }

    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
        return withLeadingSlash.slice(0, -1)
    }

    return withLeadingSlash
}

const apiBasePath = normalizeApiBasePath(
    import.meta.env.VITE_API_BASE_PATH ?? DEFAULT_API_BASE_PATH,
)

export const baseApi = createApi({
    reducerPath: 'baseApi',
    tagTypes: [
        'User',
        'Auth',
        'Project',
        'ProjectMember',
        'ProjectSkill',
        'Task',
        'TaskAssignee',
    ],
    baseQuery: fetchBaseQuery({
        baseUrl: apiBasePath,
        credentials: 'include',
    }),
    endpoints: () => ({}),
})
