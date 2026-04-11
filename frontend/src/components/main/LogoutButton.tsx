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
            className={`flex w-full min-w-0 items-center rounded-lg text-[var(--muted)] transition-[padding,background-color,color] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] ${
                collapsed
                    ? 'justify-center px-2 py-2'
                    : 'gap-2.5 px-2.5 py-[7px] text-sm'
            }`}
        >
            <LogOut size={16} />
            <span
                className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${
                    collapsed ? 'max-w-0 opacity-0' : 'max-w-[8rem] opacity-100'
                }`}
            >
                Log Out
            </span>
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
