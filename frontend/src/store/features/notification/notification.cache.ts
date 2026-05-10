import type { Draft } from '@reduxjs/toolkit'
import type { Notification } from './notification.types'

export const upsertNotification = (
    draft: Draft<Notification[]>,
    notification: Notification,
) => {
    const existingIndex = draft.findIndex((item) => item.id === notification.id)

    if (existingIndex === -1) {
        draft.push(notification)
        return
    }

    draft[existingIndex] = notification
}

export const removeNotification = (
    draft: Draft<Notification[]>,
    notificationId: string,
) => {
    const existingIndex = draft.findIndex((item) => item.id === notificationId)

    if (existingIndex !== -1) {
        draft.splice(existingIndex, 1)
    }
}

export const markNotificationAsRead = (
    draft: Draft<Notification[]>,
    notificationId: string,
) => {
    const notification = draft.find((item) => item.id === notificationId)

    if (notification) {
        notification.read = true
    }
}
