import { Button } from '@heroui/react'
import { useState } from 'react'
import {
    Archive,
    FolderKanban,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SidebarItems, type SidebarProject } from '../main/SidebarItems'
import { SidebarTooltip } from '../main/SidebarTooltip'
import { LogoutButton } from '../../shared/components/LogoutButton'
import { LogoutConfirmDialog } from '../../shared/components/LogoutConfirmDialog'
import { useGetProjectsQuery } from '../../store/features/project/project.api'
import clsx from 'clsx'

interface SidebarProps {
    collapsed: boolean
    onToggle: () => void
    onCreateProject: () => void
}

export function Sidebar({
    collapsed,
    onToggle,
    onCreateProject,
}: SidebarProps) {
    const { t } = useTranslation('common')
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
    const { data: projects = [] } = useGetProjectsQuery()

    const sidebarProjects: SidebarProject[] = projects.map((project) => {
        const status: SidebarProject['status'] =
            project.status === 'archived' ? 'archived' : 'active'

        return {
            id: project.id,
            label: project.name,
            status,
            icon:
                status === 'archived' ? (
                    <Archive size={14} />
                ) : (
                    <FolderKanban size={14} />
                ),
        }
    })

    const toggleButton = (
        <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={onToggle}
            className="text-muted border-none hover:text-(--foreground)"
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
            className={clsx(
                'border-border bg-surface relative flex h-full shrink-0 flex-col overflow-hidden border-r',
                'transition-[width] duration-300 ease-in-out',
                collapsed ? 'w-[68px]' : 'w-[240px]',
            )}
        >
            <div
                className={clsx(
                    'flex shrink-0 px-2 py-3',
                    collapsed ? 'justify-center' : 'justify-end',
                )}
            >
                {collapsed ? (
                    <SidebarTooltip label={t('navigation.expandSidebar')}>
                        {toggleButton}
                    </SidebarTooltip>
                ) : (
                    toggleButton
                )}
            </div>

            <SidebarItems
                collapsed={collapsed}
                projects={sidebarProjects}
                onCreateProject={onCreateProject}
            />

            <div
                className={clsx(
                    'border-border flex shrink-0 border-t px-2 py-3',
                    collapsed ? 'justify-center' : 'justify-end',
                )}
            >
                <LogoutButton
                    collapsed={collapsed}
                    variant="sidebar"
                    onPress={() => setIsLogoutConfirmOpen(true)}
                />
            </div>
            <LogoutConfirmDialog
                isOpen={isLogoutConfirmOpen}
                onOpenChange={setIsLogoutConfirmOpen}
            />
        </aside>
    )
}
