import { Spinner } from '@heroui/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Notification } from '../../store/features/notification/notification.types'
import { NotificationRow } from './NotificationRow'

const SCROLL_READ_DEBOUNCE_MS = 250

interface NotificationPopoverContentProps {
    isOpen: boolean
    isLoading: boolean
    notifications: Notification[]
    unreadCount: number
    deletingNotificationId: string | null
    resolvingNotificationId: string | null
    visuallyUnreadNotificationIds: Set<string>
    onDelete: (notificationId: string) => void
    onView: (notificationId: string) => void
    onNotificationsVisible: (notificationIds: string[]) => void
}

export function NotificationPopoverContent({
    isOpen,
    isLoading,
    notifications,
    unreadCount,
    deletingNotificationId,
    resolvingNotificationId,
    visuallyUnreadNotificationIds,
    onDelete,
    onView,
    onNotificationsVisible,
}: Readonly<NotificationPopoverContentProps>) {
    const { t } = useTranslation('common')
    const listRef = useRef<HTMLDivElement | null>(null)
    const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
    const scrollReadDebounceRef = useRef<ReturnType<
        typeof window.setTimeout
    > | null>(null)
    const notificationIdsKey = useMemo(
        () => notifications.map((notification) => notification.id).join('|'),
        [notifications],
    )

    const getVisibleNotificationIds = useCallback(() => {
        const listElement = listRef.current

        if (!listElement) {
            return []
        }

        const listRect = listElement.getBoundingClientRect()
        const visibleNotificationIds: string[] = []

        rowRefs.current.forEach((rowElement, notificationId) => {
            const rowRect = rowElement.getBoundingClientRect()
            const visibleHeight =
                Math.min(rowRect.bottom, listRect.bottom) -
                Math.max(rowRect.top, listRect.top)
            const visibleWidth =
                Math.min(rowRect.right, listRect.right) -
                Math.max(rowRect.left, listRect.left)

            if (visibleHeight > 0 && visibleWidth > 0) {
                visibleNotificationIds.push(notificationId)
            }
        })

        return visibleNotificationIds
    }, [])

    const markVisibleNotifications = useCallback(() => {
        const visibleNotificationIds = getVisibleNotificationIds()

        if (visibleNotificationIds.length > 0) {
            onNotificationsVisible(visibleNotificationIds)
        }
    }, [getVisibleNotificationIds, onNotificationsVisible])

    const handleNotificationListScroll = useCallback(() => {
        if (scrollReadDebounceRef.current) {
            window.clearTimeout(scrollReadDebounceRef.current)
        }

        scrollReadDebounceRef.current = window.setTimeout(() => {
            scrollReadDebounceRef.current = null
            markVisibleNotifications()
        }, SCROLL_READ_DEBOUNCE_MS)
    }, [markVisibleNotifications])

    useEffect(() => {
        return () => {
            if (scrollReadDebounceRef.current) {
                window.clearTimeout(scrollReadDebounceRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (!isOpen || isLoading || notifications.length === 0) {
            return
        }

        const animationFrameId = window.requestAnimationFrame(
            markVisibleNotifications,
        )

        return () => {
            window.cancelAnimationFrame(animationFrameId)
        }
    }, [
        isLoading,
        isOpen,
        markVisibleNotifications,
        notificationIdsKey,
        notifications.length,
    ])

    return (
        <div className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg">
            <div className="border-border border-b px-4 py-3">
                <h2 className="text-foreground text-sm font-semibold">
                    {t('notification.title')}
                </h2>
                <p className="text-muted mt-1 text-xs">
                    {t('notification.unreadCount', { count: unreadCount })}
                </p>
            </div>

            {isLoading && (
                <div className="flex min-h-40 items-center justify-center">
                    <Spinner size="md" />
                </div>
            )}

            {!isLoading && notifications.length === 0 && (
                <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
                    <p className="text-foreground text-sm font-medium">
                        {t('notification.emptyTitle')}
                    </p>
                    <p className="text-muted mt-1 text-sm">
                        {t('notification.emptyDescription')}
                    </p>
                </div>
            )}

            {!isLoading && notifications.length > 0 && (
                <div
                    ref={listRef}
                    onScroll={handleNotificationListScroll}
                    className="max-h-[min(420px,70vh)] overflow-y-auto"
                >
                    {notifications.map((notification) => (
                        <NotificationRow
                            key={notification.id}
                            ref={(rowElement) => {
                                if (rowElement) {
                                    rowRefs.current.set(
                                        notification.id,
                                        rowElement,
                                    )
                                    return
                                }

                                rowRefs.current.delete(notification.id)
                            }}
                            notification={notification}
                            isDeleting={
                                deletingNotificationId === notification.id
                            }
                            isTargetPending={
                                resolvingNotificationId === notification.id
                            }
                            isVisuallyUnread={
                                !notification.read ||
                                visuallyUnreadNotificationIds.has(
                                    notification.id,
                                )
                            }
                            onDelete={onDelete}
                            onView={onView}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
