import { Tooltip } from '@heroui/react'
import type { ReactElement } from 'react'

interface SidebarTooltipProps {
    label: string
    children: ReactElement
}

export function SidebarTooltip({ label, children }: SidebarTooltipProps) {
    return (
        <Tooltip>
            <Tooltip.Trigger>{children}</Tooltip.Trigger>
            <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip>
    )
}
