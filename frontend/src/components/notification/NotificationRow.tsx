import { Button, Spinner } from '@heroui/react'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Notification } from '../../store/features/notification/notification.types'

interface NotificationRowProps {
    notification: Notification
    isDeleting: boolean
    isTargetPending: boolean
    isVisuallyUnread: boolean
    onDelete: (notificationId: string) => void
    onView: (notificationId: string) => void
}

const formatObjectType = (objectType: string) =>
    objectType.replaceAll('_', ' ').trim() || 'notification'

export const NotificationRow = forwardRef<
    HTMLDivElement,
    Readonly<NotificationRowProps>
>(function NotificationRow(
    {
        notification,
        isDeleting,
        isTargetPending,
        isVisuallyUnread,
        onDelete,
        onView,
    },
    ref,
) {
    const { t } = useTranslation('common')
    const objectTypeLabel = t(
        `notification.objectTypes.${notification.objectType}`,
        { defaultValue: formatObjectType(notification.objectType) },
    )

    return (
        <div
            ref={ref}
            className={[
                'border-border flex w-full items-start gap-3 border-b border-l-2 px-4 py-3 transition-colors last:border-b-0',
                isVisuallyUnread
                    ? 'border-l-accent bg-accent/5 hover:bg-accent/10'
                    : 'border-l-surface bg-surface hover:bg-surface-secondary',
            ].join(' ')}
        >
            <button
                type="button"
                aria-busy={isTargetPending}
                onClick={() => onView(notification.id)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
                <span
                    aria-hidden="true"
                    className={[
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        isVisuallyUnread ? 'bg-accent' : 'bg-transparent',
                    ].join(' ')}
                />

                <span className="min-w-0 flex-1">
                    <span className="text-foreground line-clamp-2 h-10 text-sm leading-5 font-medium">
                        {notification.message}
                    </span>
                    <span className="text-muted mt-1 block text-xs capitalize">
                        {objectTypeLabel}
                    </span>
                </span>

                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center">
                    {isTargetPending && <Spinner color="current" size="sm" />}
                </span>
            </button>

            <Button
                aria-label={t('notification.deleteAriaLabel')}
                variant="ghost"
                isIconOnly
                isDisabled={isDeleting}
                isPending={isDeleting}
                onPress={() => onDelete(notification.id)}
                className="text-muted hover:text-danger h-8 w-8 min-w-8 shrink-0"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    )
})
