import { Button, ListBox, Select, Tabs } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Clock3, Shield, User, Users, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import {
    ProfileSection,
    SecuritySection,
    SkillsSection,
    WorkingHoursSection,
    UsersSection,
} from '../components/account'
import { isOpenNetworkApplicationMode } from '../config/applicationMode'
import { useAppSelector } from '../shared/hooks/redux'
import useMediaQuery from '../shared/hooks/useMediaQuery'
import { useGetUserByIdQuery } from '../store/features/user/user.api'
import { selectUserId } from '../store/userSlice'
import { AccountPageSkeleton } from './AccountPageSkeleton'
import { skipToken } from '@reduxjs/toolkit/query'

type AccountTab = 'profile' | 'security' | 'skills' | 'working-hours' | 'users'

interface AccountTabDefinition {
    id: AccountTab
    labelKey: 'profile' | 'security' | 'skills' | 'workingHours' | 'users'
    icon: LucideIcon
    requiresUserManagement?: boolean
}

const accountTabDefinitions: readonly AccountTabDefinition[] = [
    { id: 'profile', labelKey: 'profile', icon: User },
    { id: 'security', labelKey: 'security', icon: Shield },
    { id: 'skills', labelKey: 'skills', icon: Wrench },
    { id: 'working-hours', labelKey: 'workingHours', icon: Clock3 },
    {
        id: 'users',
        labelKey: 'users',
        icon: Users,
        requiresUserManagement: true,
    },
]

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
    const shouldUseSelectNavigation = useMediaQuery('(max-width: 1279px)')
    const availableTabDefinitions = accountTabDefinitions.filter(
        (item) => !item.requiresUserManagement || canManageUsers,
    )
    const availableTabs = availableTabDefinitions.map((item) => item.id)

    if (isLoading) return <AccountPageSkeleton />
    if (!isAccountTab(tab, availableTabs)) {
        return <Navigate to="/settings/profile" replace />
    }

    const selectedTab = availableTabDefinitions.find((item) => item.id === tab)
    const SelectedTabIcon = selectedTab?.icon

    const handleTabChange = (key: React.Key | null) => {
        if (!key) return

        navigate(`/settings/${String(key)}`, { replace: true })
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
            {shouldUseSelectNavigation ? (
                <Select
                    aria-label="Settings section"
                    variant="secondary"
                    value={tab}
                    onChange={handleTabChange}
                    className="mb-4 w-full"
                >
                    <Select.Trigger>
                        <Select.Value>
                            <div className="flex items-center gap-2">
                                {SelectedTabIcon ? (
                                    <SelectedTabIcon size={16} />
                                ) : null}
                                {selectedTab ? t(`tabs.${selectedTab.labelKey}`) : null}
                            </div>
                        </Select.Value>
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox items={availableTabDefinitions}>
                            {(item) => {
                                const Icon = item.icon

                                return (
                                    <ListBox.Item
                                        id={item.id}
                                        textValue={t(`tabs.${item.labelKey}`)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon size={16} />
                                            {t(`tabs.${item.labelKey}`)}
                                        </div>
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                )
                            }}
                        </ListBox>
                    </Select.Popover>
                </Select>
            ) : (
                <Tabs
                    variant="secondary"
                    className="w-full"
                    selectedKey={tab}
                    onSelectionChange={handleTabChange}
                >
                    <Tabs.ListContainer className="overflow-x-auto">
                        <Tabs.List
                            aria-label="Settings Tabs"
                            className="flex gap-4"
                        >
                            {availableTabDefinitions.map((item) => {
                                const Icon = item.icon

                                return (
                                    <Tabs.Tab key={item.id} id={item.id}>
                                        <div className="flex items-center gap-2 whitespace-nowrap">
                                            <Icon size={16} />
                                            {t(`tabs.${item.labelKey}`)}
                                        </div>
                                        <Tabs.Indicator />
                                    </Tabs.Tab>
                                )
                            })}
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>
            )}
            <div className="pt-4 md:pt-6">
                {tab === 'profile' ? <ProfileSection /> : null}
                {tab === 'security' ? <SecuritySection /> : null}
                {tab === 'skills' ? <SkillsSection /> : null}
                {tab === 'working-hours' ? <WorkingHoursSection /> : null}
                {tab === 'users' && canManageUsers ? <UsersSection /> : null}
            </div>
        </div>
    )
}
