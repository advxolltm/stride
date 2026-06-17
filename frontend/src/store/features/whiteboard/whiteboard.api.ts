import { baseApi } from '../../api/base.api'
import {
    ApiWhiteboardElementListSchema,
    ApiWhiteboardElementSchema,
    ApiWhiteboardSchema,
} from './whiteboard.api.types'
import type {
    ApiWhiteboard,
    ApiWhiteboardElement,
    CreateWhiteboardElementRequest,
    UpdateWhiteboardElementRequest,
    Whiteboard,
    WhiteboardElement,
} from './whiteboard.api.types'
import type {
    WhiteboardCursorSocketState,
    WhiteboardEventsSocketState,
} from './whiteboard.ui.types'
import { createWhiteboardMutationHeaders } from './whiteboard.client'
import {
    applyPersistedElementToCache,
    patchWhiteboardElementsCacheFromEvent,
    patchWhiteboardLiveOverlayFromEvent,
    patchWhiteboardRemoteSelectionsFromEvent,
    removePersistedElementFromCache,
} from './whiteboard.cache'
import {
    createWhiteboardCursorSocketState,
    sendWhiteboardCursor,
    watchWhiteboardCursorSocket,
} from './whiteboard.cursorSocket'
import {
    createWhiteboardEventsSocketState,
    sendWhiteboardLiveClear,
    sendWhiteboardSelectionUpdate,
    sendWhiteboardLiveUpdate,
    watchWhiteboardEventsSocket,
} from './whiteboard.eventsSocket'

const transformWhiteboard = (whiteboard: ApiWhiteboard): Whiteboard => ({
    id: whiteboard.id,
    projectId: whiteboard.projectId,
    createdAt: whiteboard.createdAt,
    updatedAt: whiteboard.updatedAt,
})

const transformWhiteboardElement = (
    element: ApiWhiteboardElement,
): WhiteboardElement => ({
    id: element.id,
    whiteboardId: element.whiteboardId,
    createdBy: element.createdBy,
    elementType: element.elementType,
    props: element.props,
    zIndex: element.zIndex,
    createdAt: element.createdAt,
    updatedAt: element.updatedAt,
})

export const whiteboardApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getProjectWhiteboard: builder.query<Whiteboard, string>({
            query: (projectId) => `/projects/${projectId}/whiteboard`,
            transformResponse: (response: unknown) =>
                transformWhiteboard(ApiWhiteboardSchema.parse(response)),
            providesTags: (_result, _error, projectId) => [
                { type: 'Whiteboard' as const, id: projectId },
            ],
        }),

        getProjectWhiteboardElements: builder.query<
            WhiteboardElement[],
            string
        >({
            query: (projectId) => `/projects/${projectId}/whiteboard/elements`,
            transformResponse: (response: unknown) =>
                ApiWhiteboardElementListSchema.parse(response).map(
                    transformWhiteboardElement,
                ),
            providesTags: (_result, _error, projectId) => [
                { type: 'WhiteboardElement' as const, id: projectId },
            ],
        }),

        createProjectWhiteboardElement: builder.mutation<
            WhiteboardElement,
            { projectId: string; body: CreateWhiteboardElementRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/whiteboard/elements`,
                method: 'POST',
                body,
                headers: createWhiteboardMutationHeaders(),
            }),
            transformResponse: (response: unknown) =>
                transformWhiteboardElement(
                    ApiWhiteboardElementSchema.parse(response),
                ),
            async onQueryStarted({ projectId }, { dispatch, queryFulfilled }) {
                try {
                    const { data: createdElement } = await queryFulfilled
                    dispatch(
                        whiteboardApi.util.updateQueryData(
                            'getProjectWhiteboardElements',
                            projectId,
                            (draft) =>
                                applyPersistedElementToCache(
                                    draft,
                                    createdElement,
                                ),
                        ),
                    )
                } catch {
                    return
                }
            },
        }),

        createProjectWhiteboardElementsBulk: builder.mutation<
            WhiteboardElement[],
            { projectId: string; body: CreateWhiteboardElementRequest[] }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/whiteboard/elements/bulk`,
                method: 'POST',
                body,
                headers: createWhiteboardMutationHeaders(),
            }),
            transformResponse: (response: unknown) =>
                ApiWhiteboardElementListSchema.parse(response).map(
                    transformWhiteboardElement,
                ),
            async onQueryStarted({ projectId }, { dispatch, queryFulfilled }) {
                try {
                    const { data: createdElements } = await queryFulfilled
                    dispatch(
                        whiteboardApi.util.updateQueryData(
                            'getProjectWhiteboardElements',
                            projectId,
                            (draft) => {
                                createdElements.forEach((createdElement) =>
                                    applyPersistedElementToCache(
                                        draft,
                                        createdElement,
                                    ),
                                )
                            },
                        ),
                    )
                } catch {
                    return
                }
            },
        }),

        updateProjectWhiteboardElement: builder.mutation<
            WhiteboardElement,
            {
                projectId: string
                elementId: string
                body: UpdateWhiteboardElementRequest
            }
        >({
            query: ({ projectId, elementId, body }) => ({
                url: `/projects/${projectId}/whiteboard/elements/${elementId}`,
                method: 'PATCH',
                body,
                headers: createWhiteboardMutationHeaders(),
            }),
            transformResponse: (response: unknown) =>
                transformWhiteboardElement(
                    ApiWhiteboardElementSchema.parse(response),
                ),
            async onQueryStarted({ projectId }, { dispatch, queryFulfilled }) {
                try {
                    const { data: updatedElement } = await queryFulfilled
                    dispatch(
                        whiteboardApi.util.updateQueryData(
                            'getProjectWhiteboardElements',
                            projectId,
                            (draft) =>
                                applyPersistedElementToCache(
                                    draft,
                                    updatedElement,
                                ),
                        ),
                    )
                } catch {
                    return
                }
            },
        }),

        updateProjectWhiteboardElementsBulk: builder.mutation<
            WhiteboardElement[],
            {
                projectId: string
                body: Array<
                    UpdateWhiteboardElementRequest & { elementId: string }
                >
            }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/whiteboard/elements/bulk`,
                method: 'PATCH',
                body,
                headers: createWhiteboardMutationHeaders(),
            }),
            transformResponse: (response: unknown) =>
                ApiWhiteboardElementListSchema.parse(response).map(
                    transformWhiteboardElement,
                ),
            async onQueryStarted({ projectId }, { dispatch, queryFulfilled }) {
                try {
                    const { data: updatedElements } = await queryFulfilled
                    dispatch(
                        whiteboardApi.util.updateQueryData(
                            'getProjectWhiteboardElements',
                            projectId,
                            (draft) => {
                                updatedElements.forEach((updatedElement) =>
                                    applyPersistedElementToCache(
                                        draft,
                                        updatedElement,
                                    ),
                                )
                            },
                        ),
                    )
                } catch {
                    return
                }
            },
        }),

        deleteProjectWhiteboardElement: builder.mutation<
            void,
            { projectId: string; elementId: string }
        >({
            query: ({ projectId, elementId }) => ({
                url: `/projects/${projectId}/whiteboard/elements/${elementId}`,
                method: 'DELETE',
                headers: createWhiteboardMutationHeaders(),
            }),
            async onQueryStarted(
                { projectId, elementId },
                { dispatch, queryFulfilled },
            ) {
                try {
                    await queryFulfilled
                    dispatch(
                        whiteboardApi.util.updateQueryData(
                            'getProjectWhiteboardElements',
                            projectId,
                            (draft) =>
                                removePersistedElementFromCache(
                                    draft,
                                    elementId,
                                ),
                        ),
                    )
                } catch {
                    return
                }
            },
        }),

        deleteProjectWhiteboardElementsBulk: builder.mutation<
            void,
            { projectId: string; elementIds: string[] }
        >({
            query: ({ projectId, elementIds }) => ({
                url: `/projects/${projectId}/whiteboard/elements/bulk-delete`,
                method: 'POST',
                body: elementIds,
                headers: createWhiteboardMutationHeaders(),
            }),
            async onQueryStarted(
                { projectId, elementIds },
                { dispatch, queryFulfilled },
            ) {
                try {
                    await queryFulfilled
                    dispatch(
                        whiteboardApi.util.updateQueryData(
                            'getProjectWhiteboardElements',
                            projectId,
                            (draft) => {
                                elementIds.forEach((elementId) => {
                                    const index = draft.findIndex(
                                        (element) => element.id === elementId,
                                    )

                                    if (index !== -1) {
                                        draft.splice(index, 1)
                                    }
                                })
                            },
                        ),
                    )
                } catch {
                    return
                }
            },
        }),

        watchWhiteboardCursor: builder.query<
            WhiteboardCursorSocketState,
            string
        >({
            keepUnusedDataFor: 0,
            queryFn: (projectId) => ({
                data: createWhiteboardCursorSocketState(projectId),
            }),
            async onCacheEntryAdded(projectId, lifecycleApi) {
                await watchWhiteboardCursorSocket(projectId, lifecycleApi)
            },
        }),
        watchWhiteboardEvents: builder.query<
            WhiteboardEventsSocketState,
            string
        >({
            keepUnusedDataFor: 0,
            queryFn: (projectId) => ({
                data: createWhiteboardEventsSocketState(projectId),
            }),
            async onCacheEntryAdded(projectId, lifecycleApi) {
                await watchWhiteboardEventsSocket(projectId, lifecycleApi, {
                    invalidateElementsCache: () => {
                        lifecycleApi.dispatch(
                            baseApi.util.invalidateTags([
                                {
                                    type: 'WhiteboardElement',
                                    id: projectId,
                                },
                            ]),
                        )
                    },
                    patchElementsCacheFromEvent: (message) => {
                        lifecycleApi.dispatch(
                            whiteboardApi.util.updateQueryData(
                                'getProjectWhiteboardElements',
                                projectId,
                                (draft) =>
                                    patchWhiteboardElementsCacheFromEvent(
                                        draft,
                                        message,
                                        transformWhiteboardElement,
                                    ),
                            ),
                        )
                    },
                    patchLiveOverlayFromEvent: (message) => {
                        lifecycleApi.updateCachedData((draft) => {
                            const state = lifecycleApi.getState()
                            const elementsResult =
                                whiteboardApi.endpoints.getProjectWhiteboardElements.select(
                                    projectId,
                                )(state as never)

                            patchWhiteboardLiveOverlayFromEvent(
                                draft.liveElementsById,
                                message,
                                elementsResult.data,
                            )
                            patchWhiteboardRemoteSelectionsFromEvent(
                                draft.remoteSelectionClientIdsByElementId,
                                message,
                            )
                        })
                    },
                })
            },
        }),
    }),
})

export {
    sendWhiteboardCursor,
    sendWhiteboardLiveClear,
    sendWhiteboardSelectionUpdate,
    sendWhiteboardLiveUpdate,
}

export const {
    useGetProjectWhiteboardQuery,
    useGetProjectWhiteboardElementsQuery,
    useCreateProjectWhiteboardElementMutation,
    useCreateProjectWhiteboardElementsBulkMutation,
    useUpdateProjectWhiteboardElementMutation,
    useUpdateProjectWhiteboardElementsBulkMutation,
    useDeleteProjectWhiteboardElementMutation,
    useDeleteProjectWhiteboardElementsBulkMutation,
    useWatchWhiteboardCursorQuery,
    useWatchWhiteboardEventsQuery,
} = whiteboardApi
