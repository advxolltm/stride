import { Button, Tooltip } from '@heroui/react'
import { useState } from 'react'
import { FolderKanban, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SidebarItems, type SidebarProject } from '../main/SidebarItems'
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
    const navigate = useNavigate()
    const location = useLocation()
    const { t } = useTranslation('common')
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
    const { data: projects = [] } = useGetProjectsQuery()

    const sidebarProjects: SidebarProject[] = projects.map((project) => ({
        id: project.id,
        label: project.name,
        icon: <FolderKanban size={14} />,
    }))

    const getActiveKey = () => {
        if (location.pathname === '/') {
            return 'overview'
        }

        if (location.pathname.startsWith('/project/')) {
            const projectId = location.pathname.split('/')[2]
            return projectId || ''
        }

        return ''
    }

    const handleSelect = (key: string) => {
        if (key === 'overview') {
            navigate('/')
            return
        }

        navigate(`/project/${key}`)
    }

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
            className={clsx(
                'relative flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]',
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
                    <Tooltip>
                        <Tooltip.Trigger>{toggleButton}</Tooltip.Trigger>
                        <Tooltip.Content>
                            {t('navigation.expandSidebar')}
                        </Tooltip.Content>
                    </Tooltip>
                ) : (
                    toggleButton
                )}
            </div>

            <SidebarItems
                collapsed={collapsed}
                activeKey={getActiveKey()}
                onSelect={handleSelect}
                projects={sidebarProjects}
                onCreateProject={onCreateProject}
            />

            <div className="shrink-0 border-t border-[var(--border)] px-2 py-3">
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
