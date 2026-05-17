import { Button, Tooltip } from '@heroui/react'
import { MessageCircle } from 'lucide-react'

interface FloatingChatLauncherProps {
    isOpen: boolean
    label: string
    offsetClassName: string
    onOpen: () => void
}

export function FloatingChatLauncher({
    isOpen,
    label,
    offsetClassName,
    onOpen,
}: FloatingChatLauncherProps) {
    return (
        <div
            className={`pointer-events-none fixed right-6 ${offsetClassName} z-40`}
        >
            <Tooltip delay={0}>
                <Tooltip.Trigger className="inline-flex">
                    <Button
                        isIconOnly
                        variant="secondary"
                        size="lg"
                        aria-label={label}
                        className={[
                            'pointer-events-auto h-14 w-14 rounded-full shadow-[0_18px_40px_rgba(79,70,229,0.35)] transition-all duration-300 ease-out',
                            isOpen
                                ? 'pointer-events-none translate-y-4 scale-95 opacity-0'
                                : 'translate-y-0 scale-100 opacity-100',
                        ].join(' ')}
                        onPress={onOpen}
                    >
                        <MessageCircle size={22} />
                    </Button>
                </Tooltip.Trigger>
                <Tooltip.Content showArrow placement="left" offset={8}>
                    <Tooltip.Arrow />
                    {label}
                </Tooltip.Content>
            </Tooltip>
        </div>
    )
}
