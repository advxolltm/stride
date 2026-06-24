import { Link } from 'react-router-dom'
import { NotificationsContainer } from '../notification/NotificationsContainer'
import { Logo } from './AppLogo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'
import { UserMenu } from './UserMenu'
import useMediaQuery from '../../shared/hooks/useMediaQuery'

export function AppHeader() {
    const shouldMoveControlsToUserMenu = useMediaQuery('(max-width: 634px)')

    return (
        <header className="bg-surface fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b px-4 sm:px-6">
            <Link className="cursor-pointer select-none" to={'/'}>
                <Logo />
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
                {!shouldMoveControlsToUserMenu ? (
                    <>
                        <LanguageSwitcher />
                        <div className="bg-border h-5 w-px" />
                        <ThemeSwitcher />
                        <div className="bg-border h-5 w-px" />
                    </>
                ) : null}
                <NotificationsContainer />
                <div className="bg-border h-5 w-px" />
                <UserMenu
                    showMobilePreferences={shouldMoveControlsToUserMenu}
                />
            </div>
        </header>
    )
}
