import { Button } from '@heroui/react'
import {
    ChevronDown,
    Clock3,
    Settings,
    Target,
    UserRound,
    Users,
} from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

export type ProjectSettingsTab =
    | 'general'
    | 'members'
    | 'skills'
    | 'my-skills'
    | 'my-working-hours'

const projectSettingsTabs: {
    id: ProjectSettingsTab
    labelKey: string
    icon: typeof Settings
}[] = [
    {
        id: 'general',
        labelKey: 'settingsSidebar.tabs.general',
        icon: Settings,
    },
    {
        id: 'members',
        labelKey: 'settingsSidebar.tabs.members',
        icon: Users,
    },
    {
        id: 'skills',
        labelKey: 'settingsSidebar.tabs.skills',
        icon: Target,
    },
    {
        id: 'my-skills',
        labelKey: 'settingsSidebar.tabs.mySkills',
        icon: UserRound,
    },
    {
        id: 'my-working-hours',
        labelKey: 'settingsSidebar.tabs.myWorkingHours',
        icon: Clock3,
    },
]

interface ProjectSettingsSidebarProps {
    activeTab: ProjectSettingsTab
    onTabChange: (tab: ProjectSettingsTab) => void
}

export function ProjectSettingsSidebar({
    activeTab,
    onTabChange,
}: Readonly<ProjectSettingsSidebarProps>) {
    const { t } = useTranslation('project')

    const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
        onTabChange(event.target.value as ProjectSettingsTab)
    }

    return (
        <>
            <div className="border-border bg-surface shrink-0 border-b px-4 py-3 xl:hidden">
                <label
                    htmlFor="project-settings-tab"
                    className="text-muted mb-2 block text-xs font-semibold tracking-wider uppercase"
                >
                    {t('settingsSidebar.title')}
                </label>

                <div className="relative">
                    <select
                        id="project-settings-tab"
                        value={activeTab}
                        onChange={handleSelectChange}
                        aria-label={t('settingsSidebar.title')}
                        className="border-border bg-surface text-foreground focus:border-(--accent) focus:ring-accent/20 h-11 w-full appearance-none rounded-xl border px-3 pr-10 text-sm font-medium shadow-sm transition-[border-color,box-shadow] outline-none focus:ring-3"
                    >
                        {projectSettingsTabs.map(({ id, labelKey }) => (
                            <option key={id} value={id}>
                                {t(labelKey)}
                            </option>
                        ))}
                    </select>
                    <ChevronDown
                        size={16}
                        aria-hidden
                        className="text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
                    />
                </div>
            </div>

            <div
                className="hidden h-full w-44 shrink-0 flex-col gap-1 border-r border-[var(--separator)] p-2 xl:flex"
            >
                <p className="text-muted px-3 pt-2 pb-3 text-xs font-semibold tracking-wider uppercase">
                    {t('settingsSidebar.title')}
                </p>

                {projectSettingsTabs.map(({ id, labelKey, icon: Icon }) => {
                    const isActive = activeTab === id
                    return (
                        <Button
                            key={id}
                            variant="ghost"
                            size="sm"
                            fullWidth
                            onPress={() => onTabChange(id)}
                            className={clsx(
                                'justify-start gap-2.5 font-medium',
                                isActive
                                    ? 'bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] text-(--accent)'
                                    : 'text-muted',
                            )}
                        >
                            <Icon
                                size={15}
                                className={clsx(
                                    isActive ? 'text-(--accent)' : 'text-muted',
                                )}
                            />
                            {t(labelKey)}
                        </Button>
                    )
                })}
            </div>
        </>
    )
}
