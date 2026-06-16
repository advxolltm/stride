import { Popover, toast } from '@heroui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '../../shared/hooks/redux'
import {
    isNotificationNavigable,
    shouldOpenTaskBoard,
    shouldOpenTaskDrawer,
} from '../../shared/utils/notificationBehavior'
import {
    useDeleteNotificationMutation,
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
} from '../../store/features/notification/notification.api'
import { projectApi } from '../../store/features/project/project.api'
import type { Notification } from '../../store/features/notification/notification.types'
import { useLazyGetTaskQuery } from '../../store/features/tasks/task.api'
import { NotificationBell } from './NotificationBell'
import { NotificationPopoverContent } from './NotificationPopoverContent'

const orderNotifications = (notifications: Notification[]) => {
    return notifications.toReversed()
}

const READ_VISUAL_DELAY_MS = 2000

export function NotificationsContainer() {
    const { t } = useTranslation('common')
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false)
    const [deletingNotificationId, setDeletingNotificationId] = useState<
        string | null
    >(null)
    const [resolvingNotificationId, setResolvingNotificationId] = useState<
        string | null
    >(null)
    const [visuallyUnreadNotificationIds, setVisuallyUnreadNotificationIds] =
        useState<Set<string>>(new Set())
    const unreadNotificationIdsRef = useRef<Set<string>>(new Set())
    const pendingReadNotificationIdsRef = useRef<Set<string>>(new Set())
    const readVisualTimeoutsRef = useRef<Map<string, number>>(new Map())

    const {
        data: notifications = [],
        isLoading,
    } = useGetNotificationsQuery()

    const [markRead] = useMarkNotificationReadMutation()
    const [deleteNotification] = useDeleteNotificationMutation()
    const [getTask] = useLazyGetTaskQuery()

    useEffect(() => {
        unreadNotificationIdsRef.current = new Set(
            notifications
                .filter((notification) => !notification.read)
                .map((notification) => notification.id),
        )
    }, [notifications])

    useEffect(() => {
        const readVisualTimeouts = readVisualTimeoutsRef.current

        return () => {
            readVisualTimeouts.forEach((timeoutId) => {
                window.clearTimeout(timeoutId)
            })
        }
    }, [])

    const unreadCount = useMemo(
        () => notifications.filter((notification) => !notification.read).length,
        [notifications],
    )
    const orderedNotifications = useMemo(
        () => orderNotifications(notifications),
        [notifications],
    )

    const markNotificationsRead = useCallback(
        async (notificationIds: string[]) => {
            const idsToRead = Array.from(new Set(notificationIds)).filter(
                (notificationId) =>
                    unreadNotificationIdsRef.current.has(notificationId) &&
                    !pendingReadNotificationIdsRef.current.has(notificationId),
            )

            if (idsToRead.length === 0) {
                return
            }

            idsToRead.forEach((notificationId) => {
                pendingReadNotificationIdsRef.current.add(notificationId)
            })
            setVisuallyUnreadNotificationIds((currentIds) => {
                const nextIds = new Set(currentIds)

                idsToRead.forEach((notificationId) => {
                    nextIds.add(notificationId)

                    const existingTimeoutId =
                        readVisualTimeoutsRef.current.get(notificationId)

                    if (existingTimeoutId) {
                        window.clearTimeout(existingTimeoutId)
                    }

                    const timeoutId = window.setTimeout(() => {
                        readVisualTimeoutsRef.current.delete(notificationId)
                        setVisuallyUnreadNotificationIds((latestIds) => {
                            const updatedIds = new Set(latestIds)
                            updatedIds.delete(notificationId)
                            return updatedIds
                        })
                    }, READ_VISUAL_DELAY_MS)

                    readVisualTimeoutsRef.current.set(
                        notificationId,
                        timeoutId,
                    )
                })

                return nextIds
            })

            try {
                const results = await Promise.allSettled(
                    idsToRead.map((notificationId) =>
                        markRead(notificationId).unwrap(),
                    ),
                )

                if (results.some((result) => result.status === 'rejected')) {
                    toast.danger(t('notification.markAsReadError'))
                }
            } finally {
                idsToRead.forEach((notificationId) => {
                    pendingReadNotificationIdsRef.current.delete(
                        notificationId,
                    )
                })
            }
        },
        [markRead, t],
    )

    const resolveNotificationPath = useCallback(
        async (notification: Notification) => {
            switch (notification.objectType) {
                case 'task': {
                    const task = await getTask(
                        notification.objectId,
                        true,
                    ).unwrap()

                    return {
                        path: shouldOpenTaskDrawer(notification)
                            ? `/project/${task.projectId}/tasks?view=kanban&taskID=${task.id}`
                            : `/project/${task.projectId}/tasks?view=kanban`,
                    }
                }
                case 'project':
                    return {
                        path: shouldOpenTaskBoard(notification)
                            ? `/project/${notification.objectId}/tasks?view=kanban`
                            : `/project/${notification.objectId}`,
                    }
                case 'chat':
                    return {
                        path: `/project/${notification.objectId}/chat`,
                    }
                default:
                    return null
            }
        },
        [getTask],
    )

    const handleView = async (notificationId: string) => {
        const notification = notifications.find(
            (item) => item.id === notificationId,
        )

        if (!notification || resolvingNotificationId) {
            return
        }

        void markNotificationsRead([notificationId])

        if (!isNotificationNavigable(notification)) {
            setIsOpen(false)
            return
        }

        setResolvingNotificationId(notificationId)

        try {
            const target = await resolveNotificationPath(notification)

            if (!target) {
                toast.danger(t('notification.openError'))
                return
            }

            dispatch(projectApi.util.invalidateTags([{ type: 'Project', id: 'LIST' }]))
            navigate(target.path)
            setIsOpen(false)
        } catch {
            toast.danger(t('notification.openError'))
        } finally {
            setResolvingNotificationId(null)
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
            toast.danger(t('notification.deleteError'))
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
                    isOpen={isOpen}
                    isLoading={isLoading}
                    notifications={orderedNotifications}
                    unreadCount={unreadCount}
                    deletingNotificationId={deletingNotificationId}
                    resolvingNotificationId={resolvingNotificationId}
                    visuallyUnreadNotificationIds={
                        visuallyUnreadNotificationIds
                    }
                    isNotificationNavigable={isNotificationNavigable}
                    onDelete={handleDelete}
                    onView={handleView}
                    onNotificationsVisible={markNotificationsRead}
                />
            </Popover.Content>
        </Popover>
    )
}
