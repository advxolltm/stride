import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { SidebarItemContent } from './SidebarItemContent'
import { SidebarTooltip } from './SidebarTooltip'

interface SidebarNavigationItemProps {
    href: string
    icon: ReactNode
    label: string
    collapsed: boolean
    isSelected: boolean
}

export function SidebarNavigationItem({
    href,
    icon,
    label,
    collapsed,
    isSelected,
}: SidebarNavigationItemProps) {
    const className = clsx(
        collapsed
            ? 'mx-auto flex h-10 min-h-0 w-10 items-center justify-center rounded-xl p-0 text-sm transition-colors'
            : 'flex w-full min-w-0 items-center rounded-xl px-3 py-2 text-sm transition-colors',
        'hover:bg-[var(--surface-secondary)]',
        isSelected &&
            'bg-[var(--accent)]/10 font-semibold text-[var(--accent)]',
    )

    const link = (
        <Link
            to={href}
            aria-current={isSelected ? 'page' : undefined}
            className={className}
        >
            <SidebarItemContent
                icon={icon}
                label={label}
                collapsed={collapsed}
            />
        </Link>
    )

    if (collapsed) {
        return <SidebarTooltip label={label}>{link}</SidebarTooltip>
    }

    return link
}
