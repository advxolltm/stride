import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react'
import { ChevronDown, User } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogoutButton } from '../../shared/components/LogoutButton'
import { LogoutConfirmDialog } from '../../shared/components/LogoutConfirmDialog'
import { useAppSelector } from '../../shared/hooks/redux'
import getInitials from '../../shared/utils/getInitials'
import { useGetSessionQuery } from '../../store/features/auth/auth.api'
import { useGetUserByIdQuery } from '../../store/features/user/user.api'
import { selectUserId } from '../../store/userSlice'
import { skipToken } from '@reduxjs/toolkit/query'

export function UserMenu() {
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
                    aria-label="Menu"
                    variant="ghost"
                    className="rounded-lg"
                >
                    <Avatar size="sm">
                        {avatarSrc && (
                            <Avatar.Image
                                src={avatarSrc}
                                alt={displayName || 'User'}
                            />
                        )}
                        <Avatar.Fallback className="bg-accent text-white">
                            {getInitials(displayName || 'User')}
                        </Avatar.Fallback>
                    </Avatar>

                    <span className="text-sm font-medium">{displayName}</span>

                    <ChevronDown size={16} className="text-foreground/60" />
                </Button>

                <Dropdown.Popover>
                    <Dropdown.Menu aria-label="User menu">
                        <Dropdown.Item
                            id="profile"
                            textValue="Profile"
                            onClick={() => {
                                navigate('/settings')
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <User size={16} />
                                <Label>Profile</Label>
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
