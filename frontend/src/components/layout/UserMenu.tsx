import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react'
import { useState } from 'react'
import { ChevronDown, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LogoutButton } from '../../shared/components/LogoutButton'
import { LogoutConfirmDialog } from '../../shared/components/LogoutConfirmDialog'

export function UserMenu() {
    const navigate = useNavigate()
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

    return (
        <>
            <Dropdown>
                <Button aria-label="Menu" variant="ghost" className="rounded-lg">
                    <Avatar size="sm">
                        <Avatar.Fallback className="bg-accent text-white">
                            JD
                        </Avatar.Fallback>
                    </Avatar>

                    <span className="text-sm font-medium">John Doe</span>

                    <ChevronDown size={16} className="text-foreground/60" />
                </Button>

                <Dropdown.Popover>
                    <Dropdown.Menu
                        aria-label="User menu"
                        onAction={(key) => {
                            if (key === 'profile') {
                                navigate('/settings')
                            }
                        }}
                    >
                        <Dropdown.Item id="profile" textValue="Profile">
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
