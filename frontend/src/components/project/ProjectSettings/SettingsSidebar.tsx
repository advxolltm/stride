import { Button } from '@heroui/react'
import { Settings, Users } from 'lucide-react'

type Tab = 'general' | 'members'

const tabs: { id: Tab; label: string; icon: typeof Settings }[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'members', label: 'Team', icon: Users },
]

interface SettingsSidebarProps {
    activeTab: Tab
    onTabChange: (tab: Tab) => void
}

export function SettingsSidebar({
    activeTab,
    onTabChange,
}: SettingsSidebarProps) {
    return (
        <div
            className="flex h-full w-44 shrink-0 flex-col gap-1 border-r p-4"
            style={{ borderColor: 'var(--separator)' }}
        >
            <p
                className="px-3 pt-2 pb-3 text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--muted)' }}
            >
                Project settings
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
