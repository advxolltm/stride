import { Button, Tabs } from '@heroui/react'
import { ArrowLeft, Shield, User, Users, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import {
    ProfileSection,
    SecuritySection,
    SkillsSection,
    UsersSection,
} from '../components/account'
import { isOpenNetworkApplicationMode } from '../config/applicationMode'
import { useAppSelector } from '../shared/hooks/redux'
import { useGetUserByIdQuery } from '../store/features/user/user.api'
import { selectUserId } from '../store/userSlice'
import { AccountPageSkeleton } from './AccountPageSkeleton'
import { skipToken } from '@reduxjs/toolkit/query'

const baseAccountTabs = ['profile', 'security', 'skills'] as const
type AccountTab = (typeof baseAccountTabs)[number] | 'users'

const isAccountTab = (
    tab: string | undefined,
    availableTabs: readonly AccountTab[],
): tab is AccountTab => availableTabs.includes(tab as AccountTab)

export function AccountPage() {
    const { t } = useTranslation('setting')
    const navigate = useNavigate()
    const { tab } = useParams()
    const userId = useAppSelector(selectUserId)
    const { data: user, isLoading } = useGetUserByIdQuery(userId ?? skipToken)
    const canManageUsers =
        isOpenNetworkApplicationMode && Boolean(user?.isSuperuser)
    const availableTabs: readonly AccountTab[] = canManageUsers
        ? [...baseAccountTabs, 'users']
        : baseAccountTabs

    if (isLoading) return <AccountPageSkeleton />
    if (!isAccountTab(tab, availableTabs)) {
        return <Navigate to="/settings/profile" replace />
    }

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
                selectedKey={tab}
                onSelectionChange={(key) => {
                    navigate(`/settings/${String(key)}`, { replace: true })
                }}
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
                        {canManageUsers ? (
                            <Tabs.Tab id="users">
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <Users size={16} />
                                    {t('tabs.users')}
                                </div>
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        ) : null}
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
                {canManageUsers ? (
                    <Tabs.Panel id="users" className="pt-4 md:pt-6">
                        <UsersSection />
                    </Tabs.Panel>
                ) : null}
            </Tabs>
        </div>
    )
}
