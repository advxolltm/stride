import { Button, Tooltip } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'

interface PanelActionButtonProps {
    label: string
    icon: LucideIcon
    onPress: () => void
}

export function PanelActionButton({
    label,
    icon: Icon,
    onPress,
}: PanelActionButtonProps) {
    return (
        <Tooltip delay={0}>
            <Tooltip.Trigger className="inline-flex">
                <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={label}
                    onPress={onPress}
                >
                    <Icon size={18} />
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow placement="top" offset={8}>
                <Tooltip.Arrow />
                {label}
            </Tooltip.Content>
        </Tooltip>
    )
}
