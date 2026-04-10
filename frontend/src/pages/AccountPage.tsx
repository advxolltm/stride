import { Button, Tabs } from '@heroui/react'
import { ArrowLeft, Shield, User, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ProfileTab, SecurityTab, SkillsTab } from '../components/account'

export function AccountPage() {
    const { t } = useTranslation('setting')
    const navigate = useNavigate()

    return (
        <div className="mx-auto w-full max-w-4xl px-4 py-6">
            <div className="mb-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (window.history.length > 1) {
                            navigate(-1)
                        } else {
                            navigate('/')
                        }
                    }}
                >
                    <ArrowLeft size={16} />
                    {t('back')}
                </Button>
            </div>

            <div className="mb-6">
                <h1 className="text-2xl font-semibold">{t('title')}</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    {t('description')}
                </p>
            </div>

            <Tabs
                variant="secondary"
                className="w-full"
                defaultSelectedKey="profile"
            >
                <Tabs.ListContainer className="overflow-x-auto">
                    <Tabs.List
                        aria-label="Settings Tabs"
                        className="flex gap-4"
                    >
                        <Tabs.Tab id="profile">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <User size={16} />
                                {t('tabs.profile')}
                            </div>
                            <Tabs.Indicator />
                        </Tabs.Tab>

                        <Tabs.Tab id="security">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <Shield size={16} />
                                {t('tabs.security')}
                            </div>
                            <Tabs.Indicator />
                        </Tabs.Tab>

                        <Tabs.Tab id="skills">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <Wrench size={16} />
                                {t('tabs.skills')}
                            </div>
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    </Tabs.List>
                </Tabs.ListContainer>

                <Tabs.Panel id="profile" className="pt-4 md:pt-6">
                    <ProfileTab />
                </Tabs.Panel>

                <Tabs.Panel id="security" className="pt-4 md:pt-6">
                    <SecurityTab />
                </Tabs.Panel>

                <Tabs.Panel id="skills" className="pt-4 md:pt-6">
                    <SkillsTab />
                </Tabs.Panel>
            </Tabs>
        </div>
    )
}
