import { baseApi } from "../../api/base.api";
import type { EditMessageRequest, Message, Paginated, SendMessageRequest } from "./chat.types";

export const MESSAGE_PAGE_SIZE = 10;

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
            })
        }),
		editMessage: builder.mutation<
			Message,
			{ projectId: string; messageId: string; body: EditMessageRequest }
		>({
            query: ({ projectId, messageId, body }) => ({
                url: `/projects/${projectId}/chat/message/${messageId}`,
                method: 'PATCH',
                body,
            })
		}),
        deleteMessage: builder.mutation<
            unknown,
            { projectId: string; messageId: string }
        >({
            query: ({ projectId, messageId }) => ({
                url: `/projects/${projectId}/chat/message/${messageId}`,
                method: 'DELETE',
            })
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
                };
            },
            infiniteQueryOptions: {
                initialPageParam: 0,
                getNextPageParam: (p) => {
                    if (p.page === 1) {
                        return undefined;
                    }
                    return p.page - 1;
                },
                getPreviousPageParam: (p) => {
                    if (p.page === p.pageCount) {
                        return undefined;
                    }
                    return p.page + 1;
                },
                // maxPages: 2,
				refetchCachedPages: true,
            },
            providesTags: (_result, _error, arg) => [
                { type: 'Messages', id: arg.projectId },
            ],
        })
    })
});

export const {
    useGetMessagesInfiniteQuery,
    useSendMessageMutation,
	useEditMessageMutation,
    useDeleteMessageMutation,
} = chatApi;
