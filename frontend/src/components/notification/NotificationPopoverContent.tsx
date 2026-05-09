import { Spinner } from '@heroui/react'
import type { Notification } from '../../store/features/notification/notification.types'
import { NotificationRow } from './NotificationRow'

interface NotificationPopoverContentProps {
    isLoading: boolean
    notifications: Notification[]
    unreadCount: number
    deletingNotificationId: string | null
    readingNotificationId: string | null
    onDelete: (notificationId: string) => void
    onView: (notificationId: string) => void
}

export function NotificationPopoverContent({
    isLoading,
    notifications,
    unreadCount,
    deletingNotificationId,
    readingNotificationId,
    onDelete,
    onView,
}: Readonly<NotificationPopoverContentProps>) {
    return (
        <div className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg">
            <div className="border-border border-b px-4 py-3">
                <h2 className="text-foreground text-sm font-semibold">
                    Notifications
                </h2>
                <p className="text-muted mt-1 text-xs">{unreadCount} unread</p>
            </div>

            {isLoading && (
                <div className="flex min-h-40 items-center justify-center">
                    <Spinner size="md" />
                </div>
            )}

            {!isLoading && notifications.length === 0 && (
                <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
                    <p className="text-foreground text-sm font-medium">
                        No notifications
                    </p>
                    <p className="text-muted mt-1 text-sm">
                        New updates will appear here.
                    </p>
                </div>
            )}

            {!isLoading && notifications.length > 0 && (
                <div className="max-h-[min(420px,70vh)] overflow-y-auto">
                    {notifications.map((notification) => (
                        <NotificationRow
                            key={notification.id}
                            notification={notification}
                            isDeleting={
                                deletingNotificationId === notification.id
                            }
                            isReadPending={
                                readingNotificationId === notification.id
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
