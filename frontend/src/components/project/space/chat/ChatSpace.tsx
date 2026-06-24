import { toast, type Key } from '@heroui/react'
import { skipToken } from '@reduxjs/toolkit/query'
import { MessageCircle } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { getApiErrorMessage } from '../../../../shared/utils/api/errors'
import { isProjectArchived } from '../../../../shared/utils/projectStatus'
import { useGetSessionQuery } from '../../../../store/features/auth/auth.api'
import {
    useDeleteMessageMutation,
    useEditMessageMutation,
    useGetChatMemberCursorsQuery,
    useGetMessagesInfiniteQuery,
    useMarkMessageDeliveredMutation,
    useMarkMessageReadMutation,
    useSendMessageMutation,
} from '../../../../store/features/chat/chat.api'
import { useWatchProjectChatSocketQuery } from '../../../../store/features/chat/chat.socket'
import type { Message } from '../../../../store/features/chat/chat.types'
import {
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
} from '../../../../store/features/notification/notification.api'
import { useGetProjectByIdQuery } from '../../../../store/features/project/project.api'
import { useGetUserByIdQuery } from '../../../../store/features/user/user.api'
import { ChatMessageInput } from './ChatMessageInput'
import { ChatMessageItem } from './ChatMessageItem'
import { ChatSpaceSkeleton } from './ChatSpaceSkeleton'

interface ChatSpaceProps {
    projectId?: string
    variant?: 'page' | 'embedded' | 'drawer'
    isActive?: boolean
}

export function ChatSpace({
    projectId: projectIdProp,
    variant = 'page',
    isActive = true,
}: ChatSpaceProps) {
    const { t, i18n } = useTranslation('chat')
    const { projectId: routeProjectId } = useParams()
    const projectId = projectIdProp ?? routeProjectId

    useWatchProjectChatSocketQuery(projectId ?? skipToken)

    const {
        data,
        isLoading: isMessagesLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        isFetchingPreviousPage,
        fetchPreviousPage,
        hasPreviousPage,
    } = useGetMessagesInfiniteQuery({ projectId: projectId! })

    const { data: sessionUser } = useGetSessionQuery()
    const { data: user, isLoading: isUserLoading } = useGetUserByIdQuery(
        sessionUser?.id ?? skipToken,
    )
    const { data: project, isLoading: isProjectLoading } =
        useGetProjectByIdQuery(projectId!)
    const { data: chatCursors = [] } = useGetChatMemberCursorsQuery(
        projectId ? { projectId } : skipToken,
    )
    const { data: notifications = [] } = useGetNotificationsQuery()
    const isArchived = isProjectArchived(project)

    const userMap = useMemo(
        () => new Map(project?.members.map((pm) => [pm.id, pm]) ?? []),
        [project?.members],
    )
    const uniqueMessages = useMemo(() => {
        const messages = data?.pages.flatMap((page) => page.items) ?? []
        return Array.from(
            new Map(messages.map((message) => [message.id, message])).values(),
        ).sort(
            (first, second) =>
                new Date(first.createdAt).getTime() -
                new Date(second.createdAt).getTime(),
        )
    }, [data?.pages])

    const cursorByMemberId = useMemo(
        () =>
            new Map(
                chatCursors.map((cursor) => [
                    cursor.projectMemberId,
                    cursor,
                ]),
            ),
        [chatCursors],
    )

    const currentMember = useMemo(() => {
        if (!project || !user) {
            return undefined
        }

        return project.members.find((member) => member.userId === user.id)
    }, [project, user])

    const latestNonOwnMessage = useMemo(() => {
        if (!currentMember) {
            return undefined
        }

        for (let index = uniqueMessages.length - 1; index >= 0; index -= 1) {
            const message = uniqueMessages[index]
            if (message.senderId !== currentMember.id) {
                return message
            }
        }

        return undefined
    }, [currentMember, uniqueMessages])

    const isLatestNonOwnMessageRead = useMemo(() => {
        if (!currentMember || !latestNonOwnMessage) {
            return false
        }

        const localCursor = cursorByMemberId.get(currentMember.id)
        if (!localCursor?.lastReadMessageCreatedAt) {
            return false
        }

        return (
            new Date(localCursor.lastReadMessageCreatedAt).getTime() >=
            new Date(latestNonOwnMessage.createdAt).getTime()
        )
    }, [currentMember, cursorByMemberId, latestNonOwnMessage])

    const unreadChatNotificationIds = useMemo(() => {
        if (!projectId) {
            return []
        }

        return notifications
            .filter(
                (notification) =>
                    !notification.read &&
                    notification.objectType === 'chat' &&
                    notification.objectId === projectId,
            )
            .map((notification) => notification.id)
    }, [notifications, projectId])

    const messageReceiptsById = useMemo(() => {
        const receipts = new Map<
            string,
            {
                deliveredTo: NonNullable<typeof project>['members']
                readBy: NonNullable<typeof project>['members']
            }
        >()

        if (!project) {
            return receipts
        }

        for (const message of uniqueMessages) {
            if (!message.senderId) {
                continue
            }

            const deliveredTo = project.members.filter((member) => {
                if (member.id === message.senderId) {
                    return false
                }

                const cursor = cursorByMemberId.get(member.id)
                if (!cursor) {
                    return false
                }

                return (
                    new Date(cursor.lastDeliveredMessageCreatedAt).getTime() >=
                    new Date(message.createdAt).getTime()
                )
            })

            const readBy = project.members.filter((member) => {
                if (member.id === message.senderId) {
                    return false
                }

                const cursor = cursorByMemberId.get(member.id)
                if (!cursor?.lastReadMessageCreatedAt) {
                    return false
                }

                return (
                    new Date(cursor.lastReadMessageCreatedAt).getTime() >=
                    new Date(message.createdAt).getTime()
                )
            })

            receipts.set(message.id, { deliveredTo, readBy })
        }

        return receipts
    }, [cursorByMemberId, project, uniqueMessages])

    const [sendMessage] = useSendMessageMutation()
    const [editMessage] = useEditMessageMutation()
    const [deleteMessage] = useDeleteMessageMutation()
    const [markMessageDelivered] = useMarkMessageDeliveredMutation()
    const [markMessageRead] = useMarkMessageReadMutation()
    const [markNotificationRead] = useMarkNotificationReadMutation()

    const [messageContent, setMessageContent] = useState('')

    const scrollRef = useRef<HTMLDivElement>(null)
    const topRef = useRef<HTMLDivElement>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const messageSelfCreatedRef = useRef(false)
    const initialBottomScrollDoneRef = useRef(false)
    const initialBottomScrollContextRef = useRef('')

    const [topElement, setTopElement] = useState<Message | null>(null)
    const [bottomElement, setBottomElement] = useState<Message | null>(null)

    const prevTopScrollHeight = useRef<number | null>(null)
    const prevBottomDistance = useRef<number | null>(null)
    const pendingAutoReadNotificationIdsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        const root = scrollRef.current
        const topTarget = topRef.current
        const bottomTarget = bottomRef.current

        if (!root || !topTarget || !bottomTarget) return

        const options = {
            root,
            threshold: 1.0,
            rootMargin: '0px',
        }

        const topObserver = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
                prevTopScrollHeight.current = root.scrollHeight
                setTopElement(uniqueMessages.at(0) ?? null)

                fetchNextPage()
            }
        }, options)
        topObserver.observe(topTarget)

        const bottomObserver = new IntersectionObserver(([entry]) => {
            if (
                entry.isIntersecting &&
                hasPreviousPage &&
                !isFetchingPreviousPage
            ) {
                prevBottomDistance.current = root.scrollHeight
                setBottomElement(uniqueMessages.at(-1) ?? null)

                fetchPreviousPage()
            }
        }, options)
        bottomObserver.observe(bottomTarget)

        return () => {
            topObserver.disconnect()
            bottomObserver.disconnect()
        }
    }, [
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        hasPreviousPage,
        isFetchingPreviousPage,
        fetchPreviousPage,
        isMessagesLoading,
        isProjectLoading,
        isUserLoading,
        uniqueMessages,
    ])

    useLayoutEffect(() => {
        const scrollElement = scrollRef.current
        if (!scrollElement) {
            return
        }

        const scrollContext = `${projectId ?? ''}:${variant}`
        if (initialBottomScrollContextRef.current !== scrollContext) {
            initialBottomScrollContextRef.current = scrollContext
            initialBottomScrollDoneRef.current = false
        }

        if (
            variant === 'page' &&
            uniqueMessages.length > 0 &&
            !initialBottomScrollDoneRef.current
        ) {
            scrollElement.scrollTo({
                top: scrollElement.scrollHeight,
                behavior: 'instant',
            })
            initialBottomScrollDoneRef.current = true
            return
        }

        if (messageSelfCreatedRef.current) {
            scrollElement.scrollTo({
                top: scrollElement.scrollHeight,
                behavior: 'smooth',
            })
            messageSelfCreatedRef.current = false
        }
    }, [projectId, uniqueMessages.length, variant])

    useLayoutEffect(() => {
        if (isFetchingNextPage || isFetchingPreviousPage) return

        const scrollElement = scrollRef.current
        if (!scrollElement) {
            return
        }

        const additionalScrollBy = 30

        if (topElement) {
            const element = document.getElementById(topElement.id)
            element?.scrollIntoView({
                block: 'start',
                behavior: 'instant',
            })
            scrollElement.scrollBy(0, -additionalScrollBy)
        } else if (bottomElement) {
            const element = document.getElementById(bottomElement.id)
            element?.scrollIntoView({
                block: 'end',
                behavior: 'instant',
            })
            scrollElement.scrollBy(0, additionalScrollBy)
        }

        setTopElement(null)
        setBottomElement(null)
    }, [isFetchingNextPage, isFetchingPreviousPage, bottomElement, topElement])

    useEffect(() => {
        if (!isActive || !projectId || !currentMember || !latestNonOwnMessage) {
            return
        }

        const localCursor = cursorByMemberId.get(currentMember.id)
        const latestCreatedAt = new Date(latestNonOwnMessage.createdAt).getTime()
        const deliveredCreatedAt = localCursor
            ? new Date(localCursor.lastDeliveredMessageCreatedAt).getTime()
            : 0

        if (deliveredCreatedAt >= latestCreatedAt) {
            return
        }

        const timeout = window.setTimeout(() => {
            void markMessageDelivered({
                projectId,
                body: { messageId: latestNonOwnMessage.id },
            })
                .unwrap()
                .catch(() => undefined)
        }, 500)

        return () => window.clearTimeout(timeout)
    }, [
        currentMember,
        cursorByMemberId,
        isActive,
        latestNonOwnMessage,
        markMessageDelivered,
        projectId,
    ])

    useEffect(() => {
        if (
            !isActive ||
            isArchived ||
            !projectId ||
            !currentMember ||
            !latestNonOwnMessage
        ) {
            return
        }

        const localCursor = cursorByMemberId.get(currentMember.id)
        const latestCreatedAt = new Date(latestNonOwnMessage.createdAt).getTime()
        const readCreatedAt = localCursor?.lastReadMessageCreatedAt
            ? new Date(localCursor.lastReadMessageCreatedAt).getTime()
            : 0

        if (readCreatedAt >= latestCreatedAt) {
            return
        }

        const timeout = window.setTimeout(() => {
            void markMessageRead({
                projectId,
                body: { messageId: latestNonOwnMessage.id },
            })
                .unwrap()
                .catch(() => undefined)
        }, 500)

        return () => window.clearTimeout(timeout)
    }, [
        currentMember,
        cursorByMemberId,
        isActive,
        isArchived,
        latestNonOwnMessage,
        markMessageRead,
        projectId,
    ])

    useEffect(() => {
        if (
            !isActive ||
            !isLatestNonOwnMessageRead ||
            unreadChatNotificationIds.length === 0
        ) {
            return
        }

        for (const notificationId of unreadChatNotificationIds) {
            if (pendingAutoReadNotificationIdsRef.current.has(notificationId)) {
                continue
            }

            pendingAutoReadNotificationIdsRef.current.add(notificationId)
            void markNotificationRead(notificationId)
                .unwrap()
                .catch(() => undefined)
                .finally(() => {
                    pendingAutoReadNotificationIdsRef.current.delete(
                        notificationId,
                    )
                })
        }
    }, [
        isActive,
        isLatestNonOwnMessageRead,
        markNotificationRead,
        unreadChatNotificationIds,
    ])

    if (isMessagesLoading || isProjectLoading || isUserLoading) {
        return <ChatSpaceSkeleton variant={variant} />
    }

    const isEmbedded = variant === 'embedded'
    const isDrawer = variant === 'drawer'
    const containerClassName = 'bg-background'
    const dateChipClassName = isEmbedded
        ? 'border-border bg-surface text-default-500'
        : 'border-default-200 bg-background text-default-500'

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isArchived || !messageContent) {
            return
        }

        try {
            await sendMessage({
                projectId: projectId!,
                body: {
                    content: messageContent,
                },
            }).unwrap()
            messageSelfCreatedRef.current = true
            setMessageContent('')
        } catch (error) {
            toast.danger(
                getApiErrorMessage(error, t('chat.errors.sendMessage')),
            )
        }
    }

    async function handleEditMessage(message: Message, content: string) {
        if (isArchived) {
            return
        }

        const nextContent = content.trim()
        if (!nextContent) {
            return
        }

        try {
            await editMessage({
                projectId: projectId!,
                messageId: message.id,
                body: {
                    content: nextContent,
                },
            }).unwrap()
        } catch (error) {
            toast.danger(
                getApiErrorMessage(error, t('chat.errors.editMessage')),
            )
            throw error
        }
    }

    function formattedTime(date: string | Date): string {
        return new Date(date).toLocaleTimeString(i18n.language, {
            hour: 'numeric',
            minute: 'numeric',
        })
    }

    function formattedDate(date: string | Date): string {
        return new Date(date).toLocaleDateString(i18n.language, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }

    function formattedDateTime(date: string | Date): string {
        return new Date(date).toLocaleDateString(i18n.language, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
        })
    }

    function isSameCalendarDay(left: string | Date, right: string | Date) {
        const leftDate = new Date(left)
        const rightDate = new Date(right)

        return (
            leftDate.getFullYear() === rightDate.getFullYear() &&
            leftDate.getMonth() === rightDate.getMonth() &&
            leftDate.getDate() === rightDate.getDate()
        )
    }

    function getRelativeDayLabel(date: string | Date) {
        const targetDate = new Date(date)
        const today = new Date()
        const yesterday = new Date()
        yesterday.setDate(today.getDate() - 1)

        if (isSameCalendarDay(targetDate, today)) {
            return t('chat.groups.today')
        }

        if (isSameCalendarDay(targetDate, yesterday)) {
            return t('chat.groups.yesterday')
        }

        return formattedDate(targetDate)
    }

    function messageEditedLabel(message: Message) {
        if (!message.isEdited || !message.editedAt) {
            return null
        }

        return `${t('chat.message.lastEdited')}: ${formattedDateTime(message.editedAt)}`
    }

    async function handleDeleteMessage(message: Message) {
        if (isArchived) {
            return
        }

        try {
            await deleteMessage({
                projectId: projectId!,
                messageId: message.id,
            }).unwrap()
        } catch (error) {
            toast.danger(
                getApiErrorMessage(error, t('chat.errors.deleteMessage')),
            )
        }
    }

    async function handleMessageAction(key: Key, message: Message) {
        if (key === 'delete-message') {
            await handleDeleteMessage(message)
        } else {
            console.error('unexpected message action:', key)
        }
    }

    return (
        <div
            className={[
                'flex min-h-0 flex-1 flex-col overflow-hidden',
                containerClassName,
            ].join(' ')}
        >
            <div
                className={[
                    'app-scrollbar min-h-0 flex-1 py-4',
                    uniqueMessages.length === 0
                        ? 'overflow-hidden'
                        : 'overflow-y-auto',
                    isDrawer ? 'px-4 pb-5' : 'px-5',
                ].join(' ')}
                ref={scrollRef}
            >
                {uniqueMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 py-12 text-center">
                        <div className="max-w-sm">
                            <div className="bg-success/10 text-success mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                                <MessageCircle size={24} />
                            </div>
                            <h2 className="text-foreground text-lg font-semibold">
                                {t('chat.empty.title')}
                            </h2>
                            <p className="text-default-500 mt-2 text-sm">
                                {t('chat.empty.description')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div ref={topRef} style={{ height: 1 }} />
                        {uniqueMessages.map((message, index) => {
                            const previousMessage = uniqueMessages[index - 1]
                            const sender = message.senderId
                                ? userMap.get(message.senderId)
                                : undefined
                            const receipts = messageReceiptsById.get(message.id)
                            const shouldRenderDateGroup =
                                !previousMessage ||
                                !isSameCalendarDay(
                                    previousMessage.createdAt,
                                    message.createdAt,
                                )

                            return (
                                <div key={message.id}>
                                    {shouldRenderDateGroup ? (
                                        <div className="mb-6 flex justify-center">
                                            <div
                                                className={[
                                                    'rounded-full border px-3 py-1 text-xs shadow-sm',
                                                    dateChipClassName,
                                                ].join(' ')}
                                            >
                                                {getRelativeDayLabel(
                                                    message.createdAt,
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                    <ChatMessageItem
                                        message={message}
                                        sender={sender}
                                        isOwnMessage={
                                            sender?.userId === user!.id
                                        }
                                        readOnly={isArchived}
                                        timeLabel={formattedTime(
                                            message.createdAt,
                                        )}
                                        editedLabel={messageEditedLabel(
                                            message,
                                        )}
                                        deliveredTo={receipts?.deliveredTo}
                                        readBy={receipts?.readBy}
                                        onEditMessage={handleEditMessage}
                                        onMessageAction={handleMessageAction}
                                    />
                                </div>
                            )
                        })}
                        <div ref={bottomRef} style={{ height: 1 }} />
                    </>
                )}
            </div>
            <ChatMessageInput
                messageContent={messageContent}
                onMessageContentChange={setMessageContent}
                onSubmit={handleSubmit}
                readOnly={isArchived}
                variant={variant}
            />
        </div>
    )
}
