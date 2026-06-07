import { baseApi } from '../../api/base.api'
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
            transformResponse: (response: ApiWhiteboard) =>
                transformWhiteboard(response),
            providesTags: (_result, _error, projectId) => [
                { type: 'Whiteboard' as const, id: projectId },
            ],
        }),

        getProjectWhiteboardElements: builder.query<
            WhiteboardElement[],
            string
        >({
            query: (projectId) => `/projects/${projectId}/whiteboard/elements`,
            transformResponse: (response: ApiWhiteboardElement[]) =>
                response.map(transformWhiteboardElement),
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
            transformResponse: (response: ApiWhiteboardElement) =>
                transformWhiteboardElement(response),
            async onQueryStarted(
                { projectId },
                { dispatch, queryFulfilled },
            ) {
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
            transformResponse: (response: ApiWhiteboardElement) =>
                transformWhiteboardElement(response),
            async onQueryStarted(
                { projectId },
                { dispatch, queryFulfilled },
            ) {
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
                        })
                    },
                })
            },
        }),
    }),
})

export { sendWhiteboardCursor, sendWhiteboardLiveClear, sendWhiteboardLiveUpdate }

export const {
    useGetProjectWhiteboardQuery,
    useGetProjectWhiteboardElementsQuery,
    useCreateProjectWhiteboardElementMutation,
    useUpdateProjectWhiteboardElementMutation,
    useDeleteProjectWhiteboardElementMutation,
    useWatchWhiteboardCursorQuery,
    useWatchWhiteboardEventsQuery,
} = whiteboardApi
