import type { ApiNotification, Notification } from './notification.types'

export const transformNotification = (
    notification: ApiNotification,
): Notification => ({
    id: notification.id,
    userId: notification.user_id,
    editType: notification.edit_type,
    objectType: notification.object_type,
    objectId: notification.object_id,
    message: notification.message,
    read: notification.read,
})
