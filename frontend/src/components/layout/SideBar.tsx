import { Button } from '@heroui/react'
import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SidebarItems, type SidebarProject } from '../main/SidebarItems'
import { SidebarTooltip } from '../main/SidebarTooltip'
import { LogoutButton } from '../../shared/components/LogoutButton'
import { LogoutConfirmDialog } from '../../shared/components/LogoutConfirmDialog'
import { useGetProjectsQuery } from '../../store/features/project/project.api'
import getInitials from '../../shared/utils/getInitials'
import useMediaQuery from '../../shared/hooks/useMediaQuery'
import clsx from 'clsx'

interface SidebarProps {
    collapsed: boolean
    onToggle: () => void
    onCreateProject: () => void
    className?: string
}

export function Sidebar({
    collapsed,
    onToggle,
    onCreateProject,
    className,
}: SidebarProps) {
    const { t } = useTranslation('common')
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
    const { data: projects = [] } = useGetProjectsQuery()
    const isLG = useMediaQuery('(min-width: 1024px)')
    const effectiveCollapsed = !isLG || collapsed

    const sidebarProjects: SidebarProject[] = projects.map((project) => {
        const status: SidebarProject['status'] =
            project.status === 'archived' ? 'archived' : 'active'

        return {
            id: project.id,
            label: project.name,
            status,
            icon: (
                <span className="flex h-full w-full items-center justify-center rounded-md bg-(--accent) text-xs text-white">
                    {getInitials(project.name)}
                </span>
            ),
        }
    })

    const toggleButton = (
        <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={onToggle}
            aria-label={
                effectiveCollapsed
                    ? t('navigation.expandSidebar')
                    : t('navigation.collapseSidebar')
            }
            className="text-muted border-none hover:text-(--foreground)"
        >
            {effectiveCollapsed ? (
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
                effectiveCollapsed ? 'w-17' : 'w-60',
                className,
            )}
        >
            {isLG && (
                <div
                    className={clsx(
                        'flex shrink-0 px-2 py-3',
                        effectiveCollapsed ? 'justify-center' : 'justify-end',
                    )}
                >
                    {effectiveCollapsed ? (
                        <SidebarTooltip label={t('navigation.expandSidebar')}>
                            {toggleButton}
                        </SidebarTooltip>
                    ) : (
                        <SidebarTooltip label={t('navigation.collapseSidebar')}>
                            {toggleButton}
                        </SidebarTooltip>
                    )}
                </div>
            )}

            <SidebarItems
                collapsed={effectiveCollapsed}
                projects={sidebarProjects}
                onCreateProject={onCreateProject}
            />

            <div
                className={clsx(
                    'border-border flex shrink-0 border-t px-2 py-3',
                    effectiveCollapsed ? 'justify-center' : 'justify-end',
                )}
            >
                <LogoutButton
                    collapsed={effectiveCollapsed}
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
