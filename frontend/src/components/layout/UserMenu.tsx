import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function UserMenu() {
    const navigate = useNavigate()

    return (
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

                        if (key === 'logout') {
                            console.log('logout')
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

                    <Dropdown.Item
                        id="logout"
                        textValue="Logout"
                        variant="danger"
                    >
                        <div className="flex items-center gap-2">
                            <LogOut className="text-danger" size={16} />
                            <Label>Logout</Label>
                        </div>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    )
}
