import { Link } from 'react-router-dom'
import { Logo } from './AppLogo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'
import { UserMenu } from './UserMenu'

export function AppHeader() {
    return (
        <header className="bg-surface fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b px-6">
            <Link className="cursor-pointer select-none" to={'/'}>
                <Logo />
            </Link>
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
