import { Tooltip } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

interface HeaderActionLinkProps {
    label: string
    icon: LucideIcon
    to: string
}

export function HeaderActionLink({
    label,
    icon: Icon,
    to,
}: HeaderActionLinkProps) {
    return (
        <Tooltip delay={0}>
            <Tooltip.Trigger className="inline-flex">
                <Link
                    to={to}
                    aria-label={label}
                    className="hover:bg-default/40 inline-flex h-8 w-8 items-center justify-center rounded-medium transition-colors"
                >
                    <Icon size={18} />
                </Link>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow placement="top" offset={8}>
                <Tooltip.Arrow />
                {label}
            </Tooltip.Content>
        </Tooltip>
    )
}
