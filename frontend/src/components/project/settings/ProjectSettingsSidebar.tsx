import { Button } from '@heroui/react'
import { Settings, Target, UserRound, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

type Tab = 'general' | 'members' | 'skills' | 'my-skills'

const tabs: { id: Tab; label: string; icon: typeof Settings }[] = [
    {
        id: 'general',
        label: i18n.t('settingsSidebar.tabs.general', { ns: 'project' }),
        icon: Settings,
    },
    {
        id: 'members',
        label: i18n.t('settingsSidebar.tabs.members', { ns: 'project' }),
        icon: Users,
    },
    {
        id: 'skills',
        label: i18n.t('settingsSidebar.tabs.skills', { ns: 'project' }),
        icon: Target,
    },
    {
        id: 'my-skills',
        label: i18n.t('settingsSidebar.tabs.mySkills', { ns: 'project' }),
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

            {tabs.map(({ id, label, icon: Icon }) => {
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
                        {label}
                    </Button>
                )
            })}
        </div>
    )
}
