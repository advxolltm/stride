import { Button, Spinner } from '@heroui/react'
import { X } from 'lucide-react'
import type { Notification } from '../../store/features/notification/notification.types'

interface NotificationRowProps {
    notification: Notification
    isDeleting: boolean
    isReadPending: boolean
    onDelete: (notificationId: string) => void
    onView: (notificationId: string) => void
}

const formatObjectType = (objectType: string) =>
    objectType.replaceAll('_', ' ').trim() || 'Notification'

export function NotificationRow({
    notification,
    isDeleting,
    isReadPending,
    onDelete,
    onView,
}: Readonly<NotificationRowProps>) {
    return (
        <button
            type="button"
            disabled={isReadPending}
            onClick={() => onView(notification.id)}
            className={[
                'border-border flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0',
                notification.read
                    ? 'hover:bg-surface-secondary/70'
                    : 'bg-accent/5 hover:bg-accent/10',
            ].join(' ')}
        >
            <span
                aria-hidden="true"
                className={[
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    notification.read ? 'bg-transparent' : 'bg-accent',
                ].join(' ')}
            />

            <span className="min-w-0 flex-1">
                <span className="text-foreground line-clamp-2 h-10 text-sm leading-5 font-medium">
                    {notification.message}
                </span>
                <span className="text-muted mt-1 block text-xs capitalize">
                    {formatObjectType(notification.objectType)}
                </span>
            </span>

            {isReadPending && (
                <Spinner className="mt-1 shrink-0" color="current" size="sm" />
            )}

            <span
                className="shrink-0"
                onClick={(event) => event.stopPropagation()}
            >
                <Button
                    aria-label="Delete notification"
                    variant="ghost"
                    isIconOnly
                    isDisabled={isDeleting}
                    isPending={isDeleting}
                    onPress={() => onDelete(notification.id)}
                    className="text-muted hover:text-danger h-8 w-8 min-w-8"
                >
                    <X className="h-4 w-4" />
                </Button>
            </span>
        </button>
    )
}
