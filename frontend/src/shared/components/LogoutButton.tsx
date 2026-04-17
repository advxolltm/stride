import { Button, Dropdown, Label, Tooltip } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'

interface LogoutButtonProps {
    collapsed?: boolean
    variant?: 'sidebar' | 'menu'
    onPress?: () => void
}

export function LogoutButton({
    collapsed = false,
    variant = 'sidebar',
    onPress,
}: LogoutButtonProps) {
    const { t } = useTranslation('common')

    const handlePress = () => {
        onPress?.()
    }

    const isSidebar = variant === 'sidebar'

    if (!isSidebar) {
        return (
            <Dropdown.Item
                id="logout"
                textValue={t('logout.label')}
                onAction={handlePress}
            >
                <div className="flex items-center gap-2">
                    <LogOut size={16} />
                    <Label>{t('logout.label')}</Label>
                </div>
            </Dropdown.Item>
        )
    }

    const button = (
        <Button
            variant="ghost"
            onPress={handlePress}
            className={[
                'w-full border-none text-[var(--muted)] shadow-none transition-[padding,background-color,color]',
                'hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]',
                isSidebar
                    ? collapsed
                        ? 'min-w-0 justify-center rounded-lg px-2 py-2'
                        : 'min-w-0 justify-start gap-2.5 rounded-lg px-2.5 py-[7px] text-sm'
                    : 'h-11 justify-start gap-2 rounded-xl px-3 text-sm font-medium text-[var(--foreground)]',
            ].join(' ')}
        >
            <LogOut size={16} />
            {isSidebar ? (
                <span
                    className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${
                        collapsed
                            ? 'max-w-0 opacity-0'
                            : 'max-w-[8rem] opacity-100'
                    }`}
                >
                    {t('logout.label')}
                </span>
            ) : (
                <span>{t('logout.label')}</span>
            )}
        </Button>
    )

    return (
        <>
            {isSidebar && collapsed ? (
                <Tooltip>
                    <Tooltip.Trigger>{button}</Tooltip.Trigger>
                    <Tooltip.Content>{t('logout.label')}</Tooltip.Content>
                </Tooltip>
            ) : (
                button
            )}
        </>
    )
}
