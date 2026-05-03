import { baseApi } from '../../api/base.api'
import type {
    ApiWhiteboard,
    ApiWhiteboardElement,
    CreateWhiteboardElementRequest,
    UpdateWhiteboardElementRequest,
    Whiteboard,
    WhiteboardElement,
} from './whiteboard.types'

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

        getProjectWhiteboardElements: builder.query<WhiteboardElement[], string>(
            {
                query: (projectId) =>
                    `/projects/${projectId}/whiteboard/elements`,
                transformResponse: (response: ApiWhiteboardElement[]) =>
                    response.map(transformWhiteboardElement),
                providesTags: (_result, _error, projectId) => [
                    { type: 'WhiteboardElement' as const, id: projectId },
                ],
            },
        ),

        createProjectWhiteboardElement: builder.mutation<
            WhiteboardElement,
            { projectId: string; body: CreateWhiteboardElementRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/whiteboard/elements`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: ApiWhiteboardElement) =>
                transformWhiteboardElement(response),
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
            }),
            transformResponse: (response: ApiWhiteboardElement) =>
                transformWhiteboardElement(response),
        }),

        deleteProjectWhiteboardElement: builder.mutation<
            void,
            { projectId: string; elementId: string }
        >({
            query: ({ projectId, elementId }) => ({
                url: `/projects/${projectId}/whiteboard/elements/${elementId}`,
                method: 'DELETE',
            }),
        }),
    }),
})

export const {
    useGetProjectWhiteboardQuery,
    useGetProjectWhiteboardElementsQuery,
    useCreateProjectWhiteboardElementMutation,
    useUpdateProjectWhiteboardElementMutation,
    useDeleteProjectWhiteboardElementMutation,
} = whiteboardApi
