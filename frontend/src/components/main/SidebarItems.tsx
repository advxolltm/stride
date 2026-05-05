import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight, LayoutDashboard, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { SidebarNavigationItem } from './SidebarNavigationItem'
import { SidebarTooltip } from './SidebarTooltip'

export interface SidebarProject {
    id: string
    label: string
    icon: ReactNode
}

interface SidebarItemsProps {
    collapsed: boolean
    projects: SidebarProject[]
    onCreateProject?: () => void
}

export function SidebarItems({
    collapsed,
    projects,
    onCreateProject,
}: SidebarItemsProps) {
    const { t } = useTranslation('common')
    const location = useLocation()
    const [projectsExpanded, setProjectsExpanded] = useState(true)

    const selectedProjectId = location.pathname.startsWith('/project/')
        ? (location.pathname.split('/')[2] ?? '')
        : ''

    return (
        <div
            className={clsx(
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden pt-3 pb-2',
                collapsed ? 'gap-3 px-2' : 'gap-4 px-3',
            )}
        >
            <nav
                aria-label="Main navigation"
                className={clsx(
                    'w-full min-w-0 overflow-hidden',
                    collapsed && 'flex flex-col items-center',
                )}
            >
                {!collapsed && (
                    <p className="px-3 pb-2 text-xs font-medium text-[var(--muted)]">
                        {t('navigation.home')}
                    </p>
                )}

                <SidebarNavigationItem
                    href="/"
                    icon={<LayoutDashboard size={16} />}
                    label={t('navigation.overview')}
                    collapsed={collapsed}
                    isSelected={location.pathname === '/'}
                />
            </nav>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {!collapsed && (
                    <button
                        type="button"
                        onClick={() =>
                            setProjectsExpanded((current) => !current)
                        }
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                    >
                        <span>{t('navigation.projects')}</span>
                        {projectsExpanded ? (
                            <ChevronDown size={14} />
                        ) : (
                            <ChevronRight size={14} />
                        )}
                    </button>
                )}

                {(collapsed || projectsExpanded) && (
                    <nav
                        aria-label="Projects navigation"
                        className="min-h-0 flex-1 overflow-y-auto pb-2"
                    >
                        {collapsed && (
                            <span className="sr-only">
                                {t('navigation.projects')}
                            </span>
                        )}

                        <div
                            className={clsx(
                                'flex w-full min-w-0 flex-col gap-1 overflow-visible',
                                collapsed && 'items-center',
                            )}
                        >
                            {projects.map((project) => (
                                <SidebarNavigationItem
                                    key={project.id}
                                    href={`/project/${project.id}`}
                                    icon={project.icon}
                                    label={project.label}
                                    collapsed={collapsed}
                                    isSelected={
                                        selectedProjectId === project.id
                                    }
                                />
                            ))}
                        </div>
                    </nav>
                )}
            </div>

            {collapsed ? (
                <SidebarTooltip label={t('actions.createProject')}>
                    <button
                        type="button"
                        onClick={onCreateProject}
                        className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                    >
                        <Plus size={14} />
                    </button>
                </SidebarTooltip>
            ) : (
                <button
                    type="button"
                    onClick={onCreateProject}
                    className="mt-1 flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                >
                    <Plus size={13} />
                    <span className="truncate">
                        {t('actions.createProject')}
                    </span>
                </button>
            )}
        </div>
    )
}
