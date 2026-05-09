import { Popover, toast } from '@heroui/react'
import { useMemo, useState } from 'react'
import {
    useDeleteNotificationMutation,
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
    useWatchNotificationsQuery,
} from '../../store/features/notification/notification.api'
import type { Notification } from '../../store/features/notification/notification.types'
import { NotificationBell } from './NotificationBell'
import { NotificationPopoverContent } from './NotificationPopoverContent'

const orderNotifications = (notifications: Notification[]) => {
    const unread = notifications.filter((notification) => !notification.read)
    const read = notifications.filter((notification) => notification.read)

    return [...unread.toReversed(), ...read.toReversed()]
}

export function NotificationsContainer() {
    const [isOpen, setIsOpen] = useState(false)
    const [deletingNotificationId, setDeletingNotificationId] = useState<
        string | null
    >(null)
    const [readingNotificationId, setReadingNotificationId] = useState<
        string | null
    >(null)

    const {
        data: notifications = [],
        isLoading,
        isSuccess,
    } = useGetNotificationsQuery()
    useWatchNotificationsQuery(undefined, { skip: !isSuccess })

    const [markRead] = useMarkNotificationReadMutation()
    const [deleteNotification] = useDeleteNotificationMutation()

    const unreadCount = useMemo(
        () => notifications.filter((notification) => !notification.read).length,
        [notifications],
    )
    const orderedNotifications = useMemo(
        () => orderNotifications(notifications),
        [notifications],
    )

    const handleView = async (notificationId: string) => {
        const notification = notifications.find(
            (item) => item.id === notificationId,
        )

        if (!notification || notification.read || readingNotificationId) {
            return
        }

        setReadingNotificationId(notificationId)

        try {
            await markRead(notificationId).unwrap()
        } catch {
            toast.danger('Unable to mark notification as read.')
        } finally {
            setReadingNotificationId(null)
        }
    }

    const handleDelete = async (notificationId: string) => {
        if (deletingNotificationId) {
            return
        }

        setDeletingNotificationId(notificationId)

        try {
            await deleteNotification(notificationId).unwrap()
        } catch {
            toast.danger('Unable to delete notification.')
        } finally {
            setDeletingNotificationId(null)
        }
    }

    return (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger>
                <NotificationBell unreadCount={unreadCount} />
            </Popover.Trigger>
            <Popover.Content className="mt-2 p-0" placement="bottom end">
                <NotificationPopoverContent
                    isLoading={isLoading}
                    notifications={orderedNotifications}
                    unreadCount={unreadCount}
                    deletingNotificationId={deletingNotificationId}
                    readingNotificationId={readingNotificationId}
                    onDelete={handleDelete}
                    onView={handleView}
                />
            </Popover.Content>
        </Popover>
    )
}
