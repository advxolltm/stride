import { z } from 'zod'

import { baseApi } from '../../api/base.api'
import {
    ChatMemberCursorSchema,
    createPaginatedSchema,
    MessageSchema,
    type ChatMemberCursor,
    type EditMessageRequest,
    type MarkChatCursorRequest,
    type Message,
    type Paginated,
    type SendMessageRequest,
} from './chat.types'

export const MESSAGE_PAGE_SIZE = 10
const PaginatedMessageSchema = createPaginatedSchema(MessageSchema)

const upsertChatMemberCursor = (
    draft: ChatMemberCursor[],
    cursor: ChatMemberCursor,
) => {
    const index = draft.findIndex(
        (item) => item.projectMemberId === cursor.projectMemberId,
    )

    if (index === -1) {
        draft.push(cursor)
        return
    }

    draft[index] = cursor
}

export const chatApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        sendMessage: builder.mutation<
            Message,
            { projectId: string; body: SendMessageRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/chat`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: unknown) => MessageSchema.parse(response),
        }),
        editMessage: builder.mutation<
            Message,
            { projectId: string; messageId: string; body: EditMessageRequest }
        >({
            query: ({ projectId, messageId, body }) => ({
                url: `/projects/${projectId}/chat/message/${messageId}`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (response: unknown) => MessageSchema.parse(response),
        }),
        deleteMessage: builder.mutation<
            unknown,
            { projectId: string; messageId: string }
        >({
            query: ({ projectId, messageId }) => ({
                url: `/projects/${projectId}/chat/message/${messageId}`,
                method: 'DELETE',
            }),
        }),
        getMessages: builder.infiniteQuery<
            Paginated<Message>,
            { projectId: string },
            number
        >({
            query: ({ queryArg, pageParam }) => {
                return {
                    url: `/projects/${queryArg.projectId}/chat`,
                    params: {
                        page: pageParam,
                        pageSize: MESSAGE_PAGE_SIZE,
                    },
                }
            },
            infiniteQueryOptions: {
                initialPageParam: 0,
                getNextPageParam: (p) => {
                    if (p.page === 1) {
                        return undefined
                    }
                    return p.page - 1
                },
                getPreviousPageParam: (p) => {
                    if (p.page === p.pageCount) {
                        return undefined
                    }
                    return p.page + 1
                },
                // maxPages: 2,
                refetchCachedPages: true,
            },
            transformResponse: (response: unknown) =>
                PaginatedMessageSchema.parse(response),
            providesTags: (_result, _error, arg) => [
                { type: 'Messages', id: arg.projectId },
            ],
        }),
        getChatMemberCursors: builder.query<
            ChatMemberCursor[],
            { projectId: string }
        >({
            query: ({ projectId }) => `/projects/${projectId}/chat/cursors`,
            transformResponse: (response: unknown) =>
                z.array(ChatMemberCursorSchema).parse(response),
            providesTags: (_result, _error, arg) => [
                { type: 'ChatMemberCursor', id: arg.projectId },
            ],
        }),
        markMessageDelivered: builder.mutation<
            ChatMemberCursor,
            { projectId: string; body: MarkChatCursorRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/chat/cursors/delivered`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (response: unknown) =>
                ChatMemberCursorSchema.parse(response),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'ChatMemberCursor', id: arg.projectId },
            ],
            async onQueryStarted({ projectId }, { dispatch, queryFulfilled }) {
                try {
                    const { data: cursor } = await queryFulfilled
                    dispatch(
                        chatApi.util.updateQueryData(
                            'getChatMemberCursors',
                            { projectId },
                            (draft) => {
                                upsertChatMemberCursor(draft, cursor)
                            },
                        ),
                    )
                } catch {
                    // Tag invalidation/refetch handles failed optimistic paths.
                }
            },
        }),
        markMessageRead: builder.mutation<
            ChatMemberCursor,
            { projectId: string; body: MarkChatCursorRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/chat/cursors/read`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (response: unknown) =>
                ChatMemberCursorSchema.parse(response),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'ChatMemberCursor', id: arg.projectId },
            ],
            async onQueryStarted({ projectId }, { dispatch, queryFulfilled }) {
                try {
                    const { data: cursor } = await queryFulfilled
                    dispatch(
                        chatApi.util.updateQueryData(
                            'getChatMemberCursors',
                            { projectId },
                            (draft) => {
                                upsertChatMemberCursor(draft, cursor)
                            },
                        ),
                    )
                } catch {
                    // Tag invalidation/refetch handles failed optimistic paths.
                }
            },
        }),
    }),
})

export const {
    useGetMessagesInfiniteQuery,
    useGetChatMemberCursorsQuery,
    useSendMessageMutation,
    useEditMessageMutation,
    useDeleteMessageMutation,
    useMarkMessageDeliveredMutation,
    useMarkMessageReadMutation,
} = chatApi
