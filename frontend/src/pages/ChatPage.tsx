import { useParams } from "react-router-dom"
import { useGetMessagesInfiniteQuery } from "../store/features/chat/chat.api";
import { useEffect, useRef } from "react";
import type { Project } from "../store/features/project/project.types";
import { useGetProjectByIdQuery } from "../store/features/project/project.api";

export function ChatPage() {
    const { projectId } = useParams();
    const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useGetMessagesInfiniteQuery({ projectId: projectId!! });

    const { data: project } = useGetProjectByIdQuery(projectId!)

    const userMap = new Map(project?.members.map(pm => [pm.id, pm]));

    const messages = data?.pages.flat() ?? [];

    const uniqueMessages = Array.from(
        new Map(messages.map((msg) => [msg.id, msg])).values()
    );

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scrollContainer = scrollRef.current;

        const handleScroll = () => {
            if (scrollContainer && hasNextPage && scrollContainer.scrollTop === 0) {
                fetchNextPage();
                scrollContainer.scrollTo({ top: 50 });
            }
        };

        scrollContainer?.addEventListener('scroll', handleScroll);

        return () => {
            scrollContainer?.removeEventListener('scroll', handleScroll);
        };
    }, [fetchNextPage, hasNextPage]);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
	}, []);

    if (isLoading) {
		return <div>Loading...</div>;
	} 

    return (
        <div className="flex flex-col gap-8 p-6">
            <h1>Chat for Project {projectId}</h1>

            <div
                className="flex-1 overflow-auto"
                style={{ maxHeight: "80vh" }}
                ref={scrollRef}
            >
                <div className="flex flex-col-reverse gap-4">
                    {uniqueMessages.map((message) => (
                        <div key={message.id} className="bg-gray-900 p-4 rounded-lg">
                            <strong>{message.senderId ? userMap.get(message.senderId)?.user.fullName : "<deleted user>"}</strong>
                            <p>{message.content}</p>
                            <small>
                                {new Date(message.createdAt).toLocaleString()}{" "}
                                {message.isEdited && "(edited)"}
                            </small>
                        </div>
                    ))}
                </div>

                {isFetchingNextPage && <div>Loading more...</div>}
            </div>
        </div>
    );
}
