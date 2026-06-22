import { Button, Dropdown, Label, Separator } from '@heroui/react'
import { ChevronDown, User } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
    LogoutButton,
    LogoutConfirmDialog,
    UserAvatar,
} from '../../shared/components'
import { useAppSelector } from '../../shared/hooks/redux'
import { useGetSessionQuery } from '../../store/features/auth/auth.api'
import { useGetUserByIdQuery } from '../../store/features/user/user.api'
import { selectUserId } from '../../store/userSlice'
import { skipToken } from '@reduxjs/toolkit/query'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'

interface UserMenuProps {
    showMobilePreferences?: boolean
}

export function UserMenu({
    showMobilePreferences = false,
}: Readonly<UserMenuProps>) {
    const { t } = useTranslation('common')
    const { data: user } = useGetSessionQuery()
    const userId = useAppSelector(selectUserId)
    const { data: userData } = useGetUserByIdQuery(userId ?? skipToken)

    const navigate = useNavigate()
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

    const displayName = userData?.fullName || user?.username
    const avatarSrc =
        userData?.avatarSmallUrl ?? userData?.avatarUrl ?? undefined

    return (
        <>
            <Dropdown>
                <Button
                    aria-label={t('userMenu.ariaLabel')}
                    variant="ghost"
                    className="rounded-lg"
                >
                    <UserAvatar name={displayName || 'User'} src={avatarSrc} />

                    <span className="hidden text-sm font-medium sm:block">
                        {displayName}
                    </span>

                    <ChevronDown size={16} className="text-foreground/60" />
                </Button>

                <Dropdown.Popover>
                    {showMobilePreferences ? (
                        <div className="border-border flex flex-col gap-3 border-b p-3 sm:hidden">
                            <p className="text-muted px-1 text-xs font-medium">
                                {t('userMenu.preferences')}
                            </p>
                            <div className="flex items-center justify-between gap-3">
                                <LanguageSwitcher />
                                <ThemeSwitcher />
                            </div>
                        </div>
                    ) : null}
                    <Dropdown.Menu aria-label={t('userMenu.ariaLabel')}>
                        <Dropdown.Item
                            id="profile"
                            textValue={t('userMenu.profile')}
                            onClick={() => {
                                navigate('/settings/profile')
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <User size={16} />
                                <Label>{t('userMenu.profile')}</Label>
                            </div>
                        </Dropdown.Item>

                        <Separator />
                        <LogoutButton
                            variant="menu"
                            onPress={() => setIsLogoutConfirmOpen(true)}
                        />
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>
            <LogoutConfirmDialog
                isOpen={isLogoutConfirmOpen}
                onOpenChange={setIsLogoutConfirmOpen}
            />
        </>
    )
}
