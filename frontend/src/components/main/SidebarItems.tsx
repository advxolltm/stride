import type { Key, ReactNode } from 'react'
import { Header, ListBox, Tooltip } from '@heroui/react'
import { ChevronDown, ChevronRight, LayoutDashboard, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface SidebarProject {
    id: string
    label: string
    icon: ReactNode
}

interface SidebarItemsProps {
    collapsed: boolean
    activeKey: string
    onSelect: (key: string) => void
    projects: SidebarProject[]
    onCreateProject?: () => void
}

interface SidebarItemContentProps {
    icon: ReactNode
    label: string
    collapsed: boolean
}

function SidebarItemContent({
    icon,
    label,
    collapsed,
}: SidebarItemContentProps) {
    if (collapsed) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <span className="flex h-4 w-4 items-center justify-center">
                    {icon}
                </span>
            </div>
        )
    }

    return (
        <div className="flex w-full min-w-0 items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {icon}
            </span>
            <span className="min-w-0 truncate">{label}</span>
        </div>
    )
}

function SidebarTooltip({
    label,
    children,
}: {
    label: string
    children: React.ReactElement
}) {
    return (
        <Tooltip>
            <Tooltip.Trigger>{children}</Tooltip.Trigger>
            <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip>
    )
}

export function SidebarItems({
    collapsed,
    activeKey,
    onSelect,
    projects,
    onCreateProject,
}: SidebarItemsProps) {
    const { t } = useTranslation('common')
    const [projectsExpanded, setProjectsExpanded] = useState(true)

    const handleSelectionChange = (keys: 'all' | Set<Key>) => {
        if (keys === 'all') return

        const firstKey = Array.from(keys)[0]
        if (firstKey) {
            onSelect(String(firstKey))
        }
    }

    const expandedItemClassName = [
        'w-full min-w-0 rounded-xl px-3 py-2 text-sm transition-colors',
        'data-[selected=true]:bg-[var(--accent)]/10',
        'data-[selected=true]:text-[var(--accent)]',
        'data-[selected=true]:font-semibold',
        'data-[hovered=true]:bg-[var(--surface-secondary)]',
    ].join(' ')

    const collapsedItemClassName = [
        'mx-auto flex h-10 min-h-0 w-10 items-center justify-center rounded-xl p-0 text-sm transition-colors',
        'data-[selected=true]:bg-[var(--accent)]/10',
        'data-[selected=true]:text-[var(--accent)]',
        'data-[selected=true]:font-semibold',
        'data-[hovered=true]:bg-[var(--surface-secondary)]',
    ].join(' ')

    const itemClassName = collapsed
        ? collapsedItemClassName
        : expandedItemClassName

    return (
        <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden pt-3 pb-2 ${
                collapsed ? 'gap-3 px-2' : 'gap-4 px-3'
            }`}
        >
            <ListBox
                aria-label="Main navigation"
                selectionMode="single"
                selectedKeys={new Set([activeKey])}
                onSelectionChange={handleSelectionChange}
                className={
                    collapsed
                        ? 'flex w-full min-w-0 items-center overflow-hidden'
                        : 'w-full min-w-0 overflow-hidden'
                }
            >
                <ListBox.Section>
                    {!collapsed && (
                        <Header className="px-3 pb-2 text-xs font-medium text-[var(--muted)]">
                            {t('navigation.home')}
                        </Header>
                    )}

                    <ListBox.Item
                        id="overview"
                        textValue={t('navigation.overview')}
                        className={itemClassName}
                    >
                        {collapsed ? (
                            <SidebarTooltip label={t('navigation.overview')}>
                                <div className="flex h-10 w-10 items-center justify-center">
                                    <SidebarItemContent
                                        icon={<LayoutDashboard size={16} />}
                                        label={t('navigation.overview')}
                                        collapsed
                                    />
                                </div>
                            </SidebarTooltip>
                        ) : (
                            <SidebarItemContent
                                icon={<LayoutDashboard size={16} />}
                                label={t('navigation.overview')}
                                collapsed={false}
                            />
                        )}
                    </ListBox.Item>
                </ListBox.Section>
            </ListBox>

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
                    <div className="min-h-0 flex-1 overflow-y-auto pb-2">
                        <ListBox
                            aria-label="Projects navigation"
                            selectionMode="single"
                            selectedKeys={new Set([activeKey])}
                            onSelectionChange={handleSelectionChange}
                            className={
                                collapsed
                                    ? 'flex w-full min-w-0 items-center overflow-visible'
                                    : 'w-full min-w-0 overflow-visible'
                            }
                        >
                            <ListBox.Section>
                                {collapsed && (
                                    <Header className="sr-only">
                                        {t('navigation.projects')}
                                    </Header>
                                )}

                                {projects.map((project) => (
                                    <ListBox.Item
                                        key={project.id}
                                        id={project.id}
                                        textValue={project.label}
                                        className={itemClassName}
                                    >
                                        {collapsed ? (
                                            <SidebarTooltip
                                                label={project.label}
                                            >
                                                <div className="flex h-10 w-10 items-center justify-center">
                                                    <SidebarItemContent
                                                        icon={project.icon}
                                                        label={project.label}
                                                        collapsed
                                                    />
                                                </div>
                                            </SidebarTooltip>
                                        ) : (
                                            <SidebarItemContent
                                                icon={project.icon}
                                                label={project.label}
                                                collapsed={false}
                                            />
                                        )}
                                    </ListBox.Item>
                                ))}
                            </ListBox.Section>
                        </ListBox>
                    </div>
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
