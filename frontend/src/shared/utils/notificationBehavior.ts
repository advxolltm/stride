import type { Notification } from '../../store/features/notification/notification.types'

const TASK_DRAWER_NOTIFICATION_MESSAGES = [
    'You were assigned to task:',
    'You were unassigned from task:',
]

const TASK_BOARD_NOTIFICATION_MESSAGES = ['Task deleted:']

const PROJECT_REMOVED_NOTIFICATION_PREFIX = 'You were removed from project:'
const PROJECT_DELETED_NOTIFICATION_PREFIX = 'Project deleted:'
const PROJECT_ARCHIVED_NOTIFICATION_PREFIX = 'Project archived:'
const PROJECT_UNARCHIVED_NOTIFICATION_PREFIX = 'Project unarchived:'

export type ProjectLifecycleNotificationKind =
    | 'removed'
    | 'deleted'
    | 'archived'
    | 'unarchived'

export const shouldOpenTaskDrawer = (notification: Notification) =>
    notification.objectType === 'task' &&
    TASK_DRAWER_NOTIFICATION_MESSAGES.some((messagePrefix) =>
        notification.message.startsWith(messagePrefix),
    )

export const shouldOpenTaskBoard = (notification: Notification) =>
    TASK_BOARD_NOTIFICATION_MESSAGES.some((messagePrefix) =>
        notification.message.startsWith(messagePrefix),
    )

export const getProjectLifecycleNotificationKind = (
    notification: Notification,
): ProjectLifecycleNotificationKind | null => {
    if (notification.objectType !== 'project') {
        return null
    }

    if (notification.message.startsWith(PROJECT_REMOVED_NOTIFICATION_PREFIX)) {
        return 'removed'
    }

    if (notification.message.startsWith(PROJECT_DELETED_NOTIFICATION_PREFIX)) {
        return 'deleted'
    }

    if (notification.message.startsWith(PROJECT_ARCHIVED_NOTIFICATION_PREFIX)) {
        return 'archived'
    }

    if (
        notification.message.startsWith(PROJECT_UNARCHIVED_NOTIFICATION_PREFIX)
    ) {
        return 'unarchived'
    }

    return null
}

export const isNotificationNavigable = (notification: Notification) => {
    const lifecycleKind = getProjectLifecycleNotificationKind(notification)
    return lifecycleKind !== 'removed' && lifecycleKind !== 'deleted'
}

export const shouldRedirectHomeAfterLifecycleAcknowledge = (
    lifecycleKind: ProjectLifecycleNotificationKind,
) => lifecycleKind === 'removed' || lifecycleKind === 'deleted'

export const getProjectLifecycleNotificationProjectName = (
    notification: Notification,
) => {
    const lifecycleKind = getProjectLifecycleNotificationKind(notification)
    if (!lifecycleKind) {
        return ''
    }

    const prefixByKind: Record<ProjectLifecycleNotificationKind, string> = {
        removed: PROJECT_REMOVED_NOTIFICATION_PREFIX,
        deleted: PROJECT_DELETED_NOTIFICATION_PREFIX,
        archived: PROJECT_ARCHIVED_NOTIFICATION_PREFIX,
        unarchived: PROJECT_UNARCHIVED_NOTIFICATION_PREFIX,
    }

    return notification.message
        .slice(prefixByKind[lifecycleKind].length)
        .trim()
}
