import { Button, Tabs } from '@heroui/react'
import { ArrowLeft, Shield, User, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
    ProfileSection,
    SecuritySection,
    SkillsSection,
} from '../components/account'
import { useAppSelector } from '../shared/hooks/redux'
import { useGetUserByIdQuery } from '../store/features/user/user.api'
import { selectUserId } from '../store/userSlice'
import { AccountPageSkeleton } from './AccountPageSkeleton'
import { skipToken } from '@reduxjs/toolkit/query'

export function AccountPage() {
    const { t } = useTranslation('setting')
    const navigate = useNavigate()
    const userId = useAppSelector(selectUserId)
    const { isLoading } = useGetUserByIdQuery(userId ?? skipToken)

    if (isLoading) return <AccountPageSkeleton />

    return (
        <div className="mx-auto w-full max-w-4xl px-4 py-6">
            <div className="mb-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (window.history.length > 1) navigate(-1)
                        else navigate('/')
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
                    <ProfileSection />
                </Tabs.Panel>
                <Tabs.Panel id="security" className="pt-4 md:pt-6">
                    <SecuritySection />
                </Tabs.Panel>
                <Tabs.Panel id="skills" className="pt-4 md:pt-6">
                    <SkillsSection />
                </Tabs.Panel>
            </Tabs>
        </div>
    )
}
