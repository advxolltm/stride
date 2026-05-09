import type { ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { SidebarNavigationItem } from './SidebarNavigationItem'
import { SidebarTooltip } from './SidebarTooltip'
import { Button } from '@heroui/react'

export interface SidebarProjectSectionItem {
    id: string
    label: string
    icon: ReactNode
}

interface SidebarProjectSectionProps {
    label: string
    emptyLabel: string
    emptyIcon: ReactNode
    collapsed: boolean
    expanded: boolean
    onToggle: () => void
    projects: SidebarProjectSectionItem[]
    selectedProjectId: string
}

export function SidebarProjectSection({
    label,
    emptyLabel,
    emptyIcon,
    collapsed,
    expanded,
    onToggle,
    projects,
    selectedProjectId,
}: SidebarProjectSectionProps) {
    return (
        <section className="min-w-0" aria-label={label}>
            {!collapsed && (
                <Button
                    variant="ghost"
                    onClick={onToggle}
                    className="text-muted mb-1 hover:bg-surface-secondary flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:text-(--foreground)"
                >
                    <span>{label}</span>
                    {expanded ? (
                        <ChevronDown size={14} />
                    ) : (
                        <ChevronRight size={14} />
                    )}
                </Button>
            )}

            {(collapsed || expanded) && (
                <div
                    className={clsx(
                        'flex w-full min-w-0 flex-col gap-1 overflow-visible',
                        collapsed && 'items-center',
                    )}
                >
                    {projects.length === 0 ? (
                        <SidebarProjectEmptyState
                            label={emptyLabel}
                            icon={emptyIcon}
                            collapsed={collapsed}
                        />
                    ) : (
                        projects.map((project) => (
                            <SidebarNavigationItem
                                key={project.id}
                                href={`/project/${project.id}`}
                                icon={project.icon}
                                label={project.label}
                                collapsed={collapsed}
                                isSelected={selectedProjectId === project.id}
                            />
                        ))
                    )}
                </div>
            )}
        </section>
    )
}

interface SidebarProjectEmptyStateProps {
    label: string
    icon: ReactNode
    collapsed: boolean
}

function SidebarProjectEmptyState({
    label,
    icon,
    collapsed,
}: SidebarProjectEmptyStateProps) {
    if (collapsed) {
        return (
            <SidebarTooltip label={label}>
                <span
                    tabIndex={0}
                    aria-label={label}
                    className="text-muted mx-auto flex h-10 w-10 items-center justify-center rounded-xl"
                >
                    {icon}
                </span>
            </SidebarTooltip>
        )
    }

    return <p className="text-muted px-3 pb-2 text-xs">{label}</p>
}
