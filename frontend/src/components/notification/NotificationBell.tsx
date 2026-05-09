import { Button } from '@heroui/react'
import { Bell } from 'lucide-react'

interface NotificationBellProps {
    unreadCount: number
}

export function NotificationBell({
    unreadCount,
}: Readonly<NotificationBellProps>) {
    const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

    return (
        <Button
            aria-label="Notifications"
            variant="ghost"
            isIconOnly
            className="relative transition-all"
        >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
                <span className="bg-danger text-danger-foreground absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold">
                    {badgeLabel}
                </span>
            )}
        </Button>
    )
}
