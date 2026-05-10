import { Tooltip } from '@heroui/react'
import type { ReactElement } from 'react'

interface SidebarTooltipProps {
    label: string
    children: ReactElement
}

export function SidebarTooltip({ label, children }: SidebarTooltipProps) {
    return (
        <Tooltip delay={0} closeDelay={0}>
            <Tooltip.Trigger className="inline-flex">
                {children}
            </Tooltip.Trigger>
            <Tooltip.Content placement="right" offset={8}>
                {label}
            </Tooltip.Content>
        </Tooltip>
    )
}
