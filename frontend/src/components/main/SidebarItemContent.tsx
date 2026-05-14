import type { ReactNode } from 'react'

interface SidebarItemContentProps {
    icon: ReactNode
    label: string
    collapsed: boolean
}

export function SidebarItemContent({
    icon,
    label,
    collapsed,
}: SidebarItemContentProps) {
    if (collapsed) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <span className="flex h-6 w-6 items-center justify-center">
                    {icon}
                </span>
            </div>
        )
    }

    return (
        <div className="flex w-full min-w-0 items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {icon}
            </span>
            <span className="min-w-0 truncate">{label}</span>
        </div>
    )
}
