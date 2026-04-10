import { Tooltip } from '@heroui/react'
import { LogOut } from 'lucide-react'

interface LogoutButtonProps {
    collapsed: boolean
    onLogout?: () => void
}

export function LogoutButton({ collapsed, onLogout }: LogoutButtonProps) {
    const button = (
        <button
            onClick={onLogout}
            className={`flex w-full rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] ${
                collapsed
                    ? 'items-center justify-center px-2 py-2'
                    : 'items-center gap-2.5 px-2.5 py-[7px] text-sm'
            }`}
        >
            <LogOut size={16} />
            {!collapsed && <span>Log Out</span>}
        </button>
    )

    if (!collapsed) {
        return button
    }

    return (
        <Tooltip>
            <Tooltip.Trigger>{button}</Tooltip.Trigger>
            <Tooltip.Content>Log Out</Tooltip.Content>
        </Tooltip>
    )
}
