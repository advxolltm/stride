import { useNavigate } from 'react-router-dom'
import { Logo } from './AppLogo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'
import { UserMenu } from './UserMenu'

export function AppHeader() {
    const navigate = useNavigate()

    return (
        <header className="bg-surface fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b px-6">
            <div
                className="cursor-pointer"
                onClick={() => {
                    navigate('/')
                }}
            >
                <Logo />
            </div>
            <div className="flex items-center gap-2">
                <LanguageSwitcher />
                <div className="bg-border h-5 w-px" />
                <ThemeSwitcher />
                <div className="bg-border h-5 w-px" />
                <UserMenu />
            </div>
        </header>
    )
}
