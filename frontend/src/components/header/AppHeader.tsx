import { LanguageSwitcher } from './LanguageSwitcher'
import { Logo } from './Logo'
import { ThemeSwitcher } from './ThemeSwitcher'
import { UserProfile } from './UserProfile'

export function AppHeader() {
    return (
        <header className="bg-surface fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b px-6">
            <Logo />
            <div className="flex items-center gap-2">
                <LanguageSwitcher />
                <div className="bg-border h-5 w-px" />
                <ThemeSwitcher />
                <div className="bg-border h-5 w-px" />
                <UserProfile />
            </div>
        </header>
    )
}
