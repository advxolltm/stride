import type { ReactNode } from 'react'
import { ArchiveX, FolderX, LayoutDashboard, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { SidebarNavigationItem } from './SidebarNavigationItem'
import { SidebarTooltip } from './SidebarTooltip'
import { SidebarProjectSection } from './SidebarProjectSection'

type ProjectStatus = 'active' | 'archived'
export interface SidebarProject {
    id: string
    label: string
    icon: ReactNode
    status: ProjectStatus
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
    const [activeProjectsExpanded, setActiveProjectsExpanded] = useState(true)
    const [archivedProjectsExpanded, setArchivedProjectsExpanded] =
        useState(true)

    const selectedProjectId = location.pathname.startsWith('/project/')
        ? (location.pathname.split('/')[2] ?? '')
        : ''

    const activeProjects = projects.filter(
        (project) => project.status === 'active',
    )

    const archivedProjects = projects.filter(
        (project) => project.status === 'archived',
    )

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
                    <p className="text-muted px-3 pb-2 text-xs font-medium">
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
                    <p className="text-muted px-3 pb-2 text-xs font-medium">
                        {t('navigation.projects')}
                    </p>
                )}

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
                            'flex w-full min-w-0 flex-col overflow-visible',
                            collapsed ? 'items-center gap-2' : 'gap-1',
                        )}
                    >
                        <SidebarProjectSection
                            label={t('navigation.activeProjects')}
                            emptyLabel={t('navigation.noActiveProjects')}
                            emptyIcon={<FolderX size={14} />}
                            collapsed={collapsed}
                            expanded={activeProjectsExpanded}
                            onToggle={() =>
                                setActiveProjectsExpanded((current) => !current)
                            }
                            projects={activeProjects}
                            selectedProjectId={selectedProjectId}
                        />

                        <SidebarProjectSection
                            label={t('navigation.archivedProjects')}
                            emptyLabel={t('navigation.noArchivedProjects')}
                            emptyIcon={<ArchiveX size={14} />}
                            collapsed={collapsed}
                            expanded={archivedProjectsExpanded}
                            onToggle={() =>
                                setArchivedProjectsExpanded(
                                    (current) => !current,
                                )
                            }
                            projects={archivedProjects}
                            selectedProjectId={selectedProjectId}
                        />
                    </div>
                </nav>
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
