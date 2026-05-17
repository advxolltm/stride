import type { Key } from '@heroui/react'
import { skipToken } from '@reduxjs/toolkit/query'
import { MessageCircle } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useGetSessionQuery } from '../../../../store/features/auth/auth.api'
import {
    useDeleteMessageMutation,
    useEditMessageMutation,
    useGetMessagesInfiniteQuery,
    useSendMessageMutation,
} from '../../../../store/features/chat/chat.api'
import type { Message } from '../../../../store/features/chat/chat.types'
import { useGetProjectByIdQuery } from '../../../../store/features/project/project.api'
import { useGetUserByIdQuery } from '../../../../store/features/user/user.api'
import { ChatMessageInput } from './ChatMessageInput'
import { ChatMessageItem } from './ChatMessageItem'
import { ChatSpaceSkeleton } from './ChatSpaceSkeleton'

interface ChatSpaceProps {
    projectId?: string
    variant?: 'page' | 'embedded'
}

export function ChatSpace({
    projectId: projectIdProp,
    variant = 'page',
}: ChatSpaceProps) {
    const { t, i18n } = useTranslation('chat')
    const { projectId: routeProjectId } = useParams()
    const projectId = projectIdProp ?? routeProjectId

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

    const userMap = new Map(project?.members.map((pm) => [pm.id, pm]))
    const messages = data?.pages.flatMap((page) => page.items) ?? []
    const uniqueMessages = Array.from(
        new Map(messages.map((message) => [message.id, message])).values(),
    )

    uniqueMessages.sort(
        (first, second) =>
            new Date(first.createdAt).getTime() -
            new Date(second.createdAt).getTime(),
    )

    const [sendMessage] = useSendMessageMutation()
    const [sendMessageError, setSendMessageError] = useState<string | null>(
        null,
    )
    console.log(sendMessageError)

    const [editMessage] = useEditMessageMutation()
    const [editMessageError, setEditMessageError] = useState<string | null>(
        null,
    )
    console.log(editMessageError)

    const [deleteMessage] = useDeleteMessageMutation()
    const [deleteMessageError, setDeleteMessageError] = useState<string | null>(
        null,
    )
    console.log(deleteMessageError)

    const [messageContent, setMessageContent] = useState('')

    const scrollRef = useRef<HTMLDivElement>(null)
    const topRef = useRef<HTMLDivElement>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const messageSelfCreatedRef = useRef(false)

    const [topElement, setTopElement] = useState<Message | null>(null)
    const [bottomElement, setBottomElement] = useState<Message | null>(null)

    const prevTopScrollHeight = useRef<number | null>(null)
    const prevBottomDistance = useRef<number | null>(null)

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

        if (messageSelfCreatedRef.current) {
            scrollElement.scrollTo({
                top: scrollElement.scrollHeight,
                behavior: 'smooth',
            })
            messageSelfCreatedRef.current = false
        }
    }, [uniqueMessages.length])

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

    if (isMessagesLoading || isProjectLoading || isUserLoading) {
        return <ChatSpaceSkeleton variant={variant} />
    }

    const isEmbedded = variant === 'embedded'
    const containerClassName = 'bg-background'
    const dateChipClassName = isEmbedded
        ? 'border-border bg-surface text-default-500'
        : 'border-default-200 bg-background text-default-500'

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!messageContent) {
            return
        }

        setSendMessageError(null)

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
            setSendMessageError(`something went wrong: ${error}`)
        }
    }

    async function handleEditMessage(message: Message, content: string) {
        const nextContent = content.trim()
        if (!nextContent) {
            return
        }

        setEditMessageError(null)

        try {
            await editMessage({
                projectId: projectId!,
                messageId: message.id,
                body: {
                    content: nextContent,
                },
            }).unwrap()
        } catch (error) {
            setEditMessageError(`something went wrong: ${error}`)
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
        setDeleteMessageError(null)

        try {
            await deleteMessage({
                projectId: projectId!,
                messageId: message.id,
            }).unwrap()
        } catch (error) {
            setSendMessageError(`something went wrong: ${error}`)
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
                    'min-h-0 flex-1 px-5 py-4',
                    uniqueMessages.length === 0
                        ? 'overflow-hidden'
                        : 'overflow-y-auto',
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
                                        timeLabel={formattedTime(
                                            message.createdAt,
                                        )}
                                        editedLabel={messageEditedLabel(
                                            message,
                                        )}
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
                variant={variant}
            />
        </div>
    )
}
