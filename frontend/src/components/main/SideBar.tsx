import { useState } from 'react'
import { Button, Tooltip } from '@heroui/react'
import {
    Megaphone,
    PanelLeftClose,
    PanelLeftOpen,
    Smartphone,
    Users,
    Wrench,
} from 'lucide-react'
import { LogoutButton } from './LogoutButton'
import { SidebarItems, type SidebarProject } from './SidebarItems'

interface SidebarProps {
    collapsed: boolean
    onToggle: () => void
}

const PROJECTS: SidebarProject[] = [
    {
        id: 'mkt',
        label: 'Marketing Campaign Q2',
        icon: <Megaphone size={14} />,
    },
    {
        id: 'mob',
        label: 'Mobile App Redesign',
        icon: <Smartphone size={14} />,
    },
    {
        id: 'cus',
        label: 'Customer Research',
        icon: <Users size={14} />,
    },
    {
        id: 'int',
        label: 'Internal Tools',
        icon: <Wrench size={14} />,
    },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const [activeNav, setActiveNav] = useState<string>('overview')

    const toggleButton = (
        <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={onToggle}
            className="border-none text-[var(--muted)] hover:text-[var(--foreground)]"
        >
            {collapsed ? (
                <PanelLeftOpen size={16} />
            ) : (
                <PanelLeftClose size={16} />
            )}
        </Button>
    )

    return (
        <aside
            className={[
                'relative flex h-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]',
                'transition-[width] duration-300 ease-in-out',
                collapsed ? 'w-[68px]' : 'w-[220px]',
            ].join(' ')}
        >
            <div
                className={`flex shrink-0 px-2 py-3 ${
                    collapsed ? 'justify-center' : 'justify-end'
                }`}
            >
                {collapsed ? (
                    <Tooltip>
                        <Tooltip.Trigger>{toggleButton}</Tooltip.Trigger>
                        <Tooltip.Content>Expand sidebar</Tooltip.Content>
                    </Tooltip>
                ) : (
                    toggleButton
                )}
            </div>

            <SidebarItems
                collapsed={collapsed}
                activeKey={activeNav}
                onSelect={setActiveNav}
                projects={PROJECTS}
            />

            <div className="shrink-0 border-t border-[var(--border)] px-2 py-3">
                <LogoutButton collapsed={collapsed} />
            </div>
        </aside>
    )
}
