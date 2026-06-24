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

export const apiBasePath = normalizeApiBasePath(
    import.meta.env.VITE_API_BASE_PATH ?? DEFAULT_API_BASE_PATH,
)

const getWebSocketOrigin = () => {
    if (typeof window === 'undefined') {
        return null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}`
}

export const buildApiWebSocketUrl = (path: string) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const prefixedPath = normalizedPath.startsWith(apiBasePath)
        ? normalizedPath
        : `${apiBasePath}${normalizedPath}`

    const webSocketOrigin = getWebSocketOrigin()
    return webSocketOrigin ? `${webSocketOrigin}${prefixedPath}` : prefixedPath
}

export const baseApi = createApi({
    reducerPath: 'baseApi',
    tagTypes: [
        'User',
        'UserSkill',
        'Auth',
        'Project',
        'ProjectMember',
        'ProjectSkill',
        'Task',
        'TaskAssignee',
        'Whiteboard',
        'WhiteboardElement',
        'Notification',
        'Messages',
        'ChatMemberCursor',
    ],
    baseQuery: fetchBaseQuery({
        baseUrl: apiBasePath,
        credentials: 'include',
    }),
    endpoints: () => ({}),
})
