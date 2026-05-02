import { baseApi } from "../../api/base.api";
import type { Message } from "./chat.types";

export const MESSAGE_PAGE_SIZE = 20;

export const chatApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getMessages: builder.infiniteQuery<
            Message[],
            { projectId: string },
            string | null
        >({
            query: ({ queryArg, pageParam }) => {
                return {
                    url: `/projects/${queryArg.projectId}/chat`,
                    params: pageParam ? {
                        createdBefore: pageParam,
                        count: MESSAGE_PAGE_SIZE,
                    } : {
                        createdBefore: (new Date()).toISOString(),
                        count: MESSAGE_PAGE_SIZE,
                    },
                };
            },

            infiniteQueryOptions: {
                initialPageParam: null,
                getNextPageParam: (lastPage) => {
                    console.log("getting next page param", lastPage);
                    if (lastPage.length === 0) {
                        return undefined;
                    }
                    const earliestMsg = lastPage.reduce((m1, m2) => new Date(m1.createdAt) < new Date(m2.createdAt) ? m1 : m2, {
                        createdAt: "",
                    } as Message);
                    return earliestMsg.createdAt;

                }
            }
        })
    })
});

export const {
    useGetMessagesInfiniteQuery
} = chatApi;
