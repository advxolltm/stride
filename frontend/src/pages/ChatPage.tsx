import { useParams } from "react-router-dom"
import { useDeleteMessageMutation, useEditMessageMutation, useGetMessagesInfiniteQuery, useSendMessageMutation } from "../store/features/chat/chat.api";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ProjectMember } from "../store/features/project/project.types";
import { useGetProjectByIdQuery } from "../store/features/project/project.api";
import { useGetSessionQuery } from "../store/features/auth/auth.api";
import { useGetUserByIdQuery } from "../store/features/user/user.api";
import { skipToken } from "@reduxjs/toolkit/query";
import type { Message } from "../store/features/chat/chat.types";
import { useTranslation } from 'react-i18next';
import {
    Avatar,
    Button,
    Input,
    Form,
    Dropdown,
} from '@heroui/react';
import getInitials from "../shared/utils/getInitials";
import { SendHorizontal, ChevronDown, Trash2, Pencil } from 'lucide-react';

// Chat layout inspired by: https://tailwindflex.com/@Gidyofficial/chat-bar
export function ChatPage() {
    const { t, i18n } = useTranslation('chat')

    const { projectId } = useParams();
    const {
        data,
        isLoading: isMessagesLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        isFetchingPreviousPage,
        fetchPreviousPage,
        hasPreviousPage,
    } = useGetMessagesInfiniteQuery({ projectId: projectId!! });

    const { data: sessionUser } = useGetSessionQuery()
    const { data: user, isLoading: isUserLoading } = useGetUserByIdQuery(sessionUser?.id ?? skipToken)

    const { data: project, isLoading: isProjectLoading } = useGetProjectByIdQuery(projectId!)

    const userMap = new Map(project?.members.map(pm => [pm.id, pm]));

    const messages = data?.pages
        .flatMap(p => p.items) ?? [];

    let uniqueMessages = Array.from(
        new Map(messages.map((msg) => [msg.id, msg])).values()
    );

    uniqueMessages.sort((m1, m2) => new Date(m1.createdAt).getTime() - new Date(m2.createdAt).getTime());


    const [sendMessage, { isLoading: isSendingMessage }] = useSendMessageMutation();
    const [sendMessageError, setSendMessageError] = useState<string | null>(null)

    const [editMessage, { isLoading: isEditingMessage }] = useEditMessageMutation();
    const [editMessageError, setEditMessageError] = useState<string | null>(null)

    const [deleteMessage, { isLoading: isDeletingMessage }] = useDeleteMessageMutation();
    const [deleteMessageError, setDeleteMessageError] = useState<string | null>(null)


    const [msgContent, setMsgContent] = useState<string>("");
    const [isEditMode, setIsEditMode] = useState<boolean>(false);
    const [msgToEdit, setMsgToEdit] = useState<Message | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [messageSelfCreated, setMessageSelfCreated] = useState<boolean>(false);

    const [topElem, setTopElem] = useState<Message | null>(null);
    const [bottomElem, setBottomElem] = useState<Message | null>(null);

    const prevTopScrollHeight = useRef<number | null>(null);
    const prevBottomDistance = useRef<number | null>(null);

    // This triggers the new page load when the top/bottom of the current (latest) page is reached (i.e. the oldest/newest fetched message)
    useEffect(() => {
        const root = scrollRef.current;
        const topTarget = topRef.current;
        const bottomTarget = bottomRef.current;

        if (!root || !topTarget || !bottomTarget) return;

        const options = {
            root,
            threshold: 1.0,
            rootMargin: "0px",
        };

        const topObserver = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
                    prevTopScrollHeight.current = root.scrollHeight;
                    setTopElem(uniqueMessages.at(0) ?? null);

                    fetchNextPage();
                }
            },
            options,
        );
        topObserver.observe(topTarget);

        const bottomObserver = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && hasPreviousPage && !isFetchingPreviousPage) {
                    prevBottomDistance.current = root.scrollHeight;
                    setBottomElem(uniqueMessages.at(-1) ?? null);

                    fetchPreviousPage();
                }
            },
            options,
        );
        bottomObserver.observe(bottomTarget);

        return () => {
            topObserver.disconnect();
            bottomObserver.disconnect();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage, hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage, isMessagesLoading, isProjectLoading, isUserLoading]);

    useEffect(() => {
		if(!isEditMode) {
			return;
		}

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
				setIsEditMode(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isEditMode]);

    useLayoutEffect(() => {
        const s = scrollRef.current;
        if (!s) {
            return;
        }
        if (messageSelfCreated) {
            s.scrollTo({
                top: s.scrollHeight,
                behavior: 'smooth'
            });
            setMessageSelfCreated(false);
        }
    }, [uniqueMessages.length])

    // Move scrollbar such that the position is at the same message as before new messages were loaded
    // Otherwise you would immediately jump to the oldest message of the latest fetch
    useLayoutEffect(() => {
        if (isFetchingNextPage || isFetchingPreviousPage) return;

        const scrollBehaviour = "instant";

        const s = scrollRef.current;
        if (!s) {
            return;
        }

        // "pads" the scrolling, I chose the number arbitrarily until the scrolling felt smooth
        const additionalScrollBy = 30;

        if (topElem) {
            const el = document.getElementById(topElem.id);
            el?.scrollIntoView({
                block: 'start',
                behavior: scrollBehaviour,
            });
            s.scrollBy(0, -additionalScrollBy);
        } else if (bottomElem) {
            const el = document.getElementById(bottomElem.id);
            el?.scrollIntoView({
                block: 'end',
                behavior: scrollBehaviour,
            });
            s.scrollBy(0, additionalScrollBy);
        }

        setTopElem(null);
        setBottomElem(null);
    }, [isFetchingNextPage, isFetchingPreviousPage, messageSelfCreated]);

    if (isMessagesLoading || isProjectLoading || isUserLoading) {
        return <div>{t('chat.loadingMessages')}</div>;
    }

    async function handleSubmitEdit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!msgContent) {
            return;
        }

        setSendMessageError(null);

        try {
            await editMessage({
                projectId: projectId!,
                messageId: msgToEdit!.id,
                body: {
                    content: msgContent,
                }
            }).unwrap();
            setMsgContent("");
            setMsgToEdit(null);
            setIsEditMode(false);
        } catch (error) {
            setSendMessageError(`something went wrong: ${error}`);
        }
    }

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!msgContent) {
            return;
        }

        setSendMessageError(null);

        try {
            await sendMessage({
                projectId: projectId!,
                body: {
                    content: msgContent,
                }
            }).unwrap();
            setMessageSelfCreated(true);
            setMsgContent("");
        } catch (error) {
            setSendMessageError(`something went wrong: ${error}`);
        }
    }

    function messageInput() {
        return (
            <div className="p-3 border-t">
                {isEditMode ? (
                    <Form onSubmit={handleSubmitEdit}>
                        <div className="flex items-center">
							<label>	EDIT MODE </label>
                            <Input
                                type="text"
                                placeholder={t('chat.input.placeholder')}
                                className="flex-1 bg-[var(--overlay)] rounded-full py-2 px-4 focus:outline-none"
                                onChange={(event: any) => setMsgContent(event.target.value)}
								value={msgContent}
                            />
                            <Button type="submit" className="ml-2 w-10 h-10 rounded-full bg-[var(--focus)] text-white flex items-center justify-center">
                                <SendHorizontal />
                            </Button>
                        </div>
                    </Form>
                ) : (
                    <Form onSubmit={handleSubmit}>
                        <div className="flex items-center">
                            <Input
                                type="text"
                                placeholder={t('chat.input.placeholder')}
                                className="flex-1 bg-[var(--overlay)] rounded-full py-2 px-4 focus:outline-none"
                                onChange={(event: any) => setMsgContent(event.target.value)}
								value={msgContent}
                            />
                            <Button type="submit" className="ml-2 w-10 h-10 rounded-full bg-[var(--focus)] text-white flex items-center justify-center">
                                <SendHorizontal />
                            </Button>
                        </div>
                    </Form>
                )
                }
            </div>
        )
    }

    function formattedDate(d: string | Date): string {
        const formattedLabel = new Date(d).toLocaleDateString(i18n.language, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: "numeric",
            minute: "numeric",
            timeZone: 'UTC',
        });
        return formattedLabel;
    }

    function senderAvatar(sender: ProjectMember) {
        return (
            <Avatar>
                <Avatar.Image src={sender.user.avatarUrl["300"] || ''} />
                <Avatar.Fallback>{getInitials(sender.user.fullName)}</Avatar.Fallback>
            </Avatar>
        )
    }

    function messageFooterContent(message: Message, userDeleted: boolean) {
        let msgFooter = formattedDate(message.createdAt);

        if (message.isEdited) {
            msgFooter += ` (${t('chat.message.lastEdited')}: ${formattedDate(message.editedAt!)})`
        }

        return msgFooter
    }

    async function handleDeleteMessage(message: Message) {
        setDeleteMessageError(null);

        try {
            await deleteMessage({
                projectId: projectId!,
                messageId: message.id,
            }).unwrap();
        } catch (error) {
            setSendMessageError(`something went wrong: ${error}`);
        }
    }

    async function handleMessageAction(key: 'edit-message' | 'delete-message', message: Message) {
        if (key === 'edit-message') {
			console.log("starting edit message", message.content);
            setIsEditMode(true);
            setMsgToEdit(message);
			setMsgContent(message.content);
        } else if (key === 'delete-message') {
            await handleDeleteMessage(message);
        } else {
            console.error("unexpected message action:", key)
        }
    }

    function messageBubble(message: Message) {
        return (
            <div className="relative">
                <div className="absolute top-1 right-1">
                    <Dropdown>
                        <Button aria-label="Menu">
                            <ChevronDown />
                        </Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu onAction={async (key) => await handleMessageAction(key, message)}>
                                <Dropdown.Item id="edit-message">
                                    <Pencil /> {t('chat.message.edit')}
                                </Dropdown.Item>
                                <Dropdown.Item
                                    className="text-danger"
                                    id="delete-message"
                                    variant="danger"
                                >
                                    <Trash2 /> {t('chat.message.delete')}
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>

                <div className="bg-[var(--focus)] text-white p-3 rounded-lg rounded-tr-none shadow-sm w-full max-w-4xl">
                    <p className="mt-6">{message.content}</p>
                </div>
            </div>
        );
    }

    function renderMessage(message: Message) {
        if (message.senderId) {
            const sender = userMap.get(message.senderId)!;
            if (sender.userId === user!.id) {
                return (
                    <div key={message.id} id={message.id} className="flex mb-4 justify-end">
                        <div className="mr-3 text-right">
                            {messageBubble(message)}
                            <span className="text-xs text-[var(--muted)] mt-1 block">
                                {messageFooterContent(message, false)}
                            </span>
                        </div>
                        {senderAvatar(sender)}
                    </div>
                )
            } else {
                return (
                    <div key={message.id} id={message.id} className="flex mb-4">
                        {senderAvatar(sender)}
                        <div className="ml-3">
                            <div className="bg-[var(--field-background)] p-3 rounded-lg rounded-tl-none shadow-sm max-w-4xl">
                                <small className="text-[var(--muted)]">{sender.user.fullName}</small>
                                <p>{message.content}</p>
                            </div>
                            <span className="text-xs text-[var(--muted)] mt-1 block">
                                {messageFooterContent(message, false)}
                            </span>
                        </div>
                    </div>
                );
            }
        } else {
            return (
                <div key={message.id} id={message.id} className="flex mb-4">
                    {/*TODO use a "missing texture" profile here to indicate a deleted user*/}
                    <Avatar>
                        <Avatar.Image src={''} />
                        <Avatar.Fallback>NA</Avatar.Fallback>
                    </Avatar>
                    <div className="ml-3">
                        <div className="bg-[var(--muted)] p-3 rounded-lg rounded-tl-none shadow-sm max-w-xs">
                            <small className="text-[var(--secondary)]">{t('chat.message.userDeleted')}</small>
                            <p>{message.content}</p>
                        </div>
                        <span className="text-xs text-[var(--muted)] mt-1 block">
                            {messageFooterContent(message, true)}
                        </span>
                    </div>
                </div>
            );
        }
    }

    function messagesArea() {
        return (
            <div className="flex-1 min-h-0 p-4 overflow-y-auto" ref={scrollRef}>
                <div ref={topRef} style={{ height: 1 }} />
                {uniqueMessages.map(renderMessage)}
                <div ref={bottomRef} style={{ height: 1 }} />
            </div>
        )
    }

    function chatDemo() {
        return (
            <div className="flex flex-col h-screen overflow-hidden bg-[var(--background)]">
                {messagesArea()}
                {messageInput()}
            </div>
        )
    }

    return (
        chatDemo()
    );
}
