import { Button } from '@heroui/react'
import { Settings, Target, UserRound, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Tab = 'general' | 'members' | 'skills' | 'my-skills'

const tabs: { id: Tab; labelKey: string; icon: typeof Settings }[] = [
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
]

interface ProjectSettingsSidebarProps {
    activeTab: Tab
    onTabChange: (tab: Tab) => void
}

export function ProjectSettingsSidebar({
    activeTab,
    onTabChange,
}: Readonly<ProjectSettingsSidebarProps>) {
    const { t } = useTranslation('project')

    return (
        <div
            className="flex h-full w-44 shrink-0 flex-col gap-1 border-r p-2"
            style={{ borderColor: 'var(--separator)' }}
        >
            <p
                className="px-3 pt-2 pb-3 text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--muted)' }}
            >
                {t('settingsSidebar.title')}
            </p>

            {tabs.map(({ id, labelKey, icon: Icon }) => {
                const isActive = activeTab === id
                return (
                    <Button
                        key={id}
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onPress={() => onTabChange(id)}
                        className="justify-start gap-2.5 font-medium"
                        style={
                            isActive
                                ? {
                                      background:
                                          'color-mix(in oklch, var(--accent) 12%, transparent)',
                                      color: 'var(--accent)',
                                  }
                                : { color: 'var(--muted)' }
                        }
                    >
                        <Icon
                            size={15}
                            style={{
                                color: isActive
                                    ? 'var(--accent)'
                                    : 'var(--muted)',
                            }}
                        />
                        {t(labelKey)}
                    </Button>
                )
            })}
        </div>
    )
}
