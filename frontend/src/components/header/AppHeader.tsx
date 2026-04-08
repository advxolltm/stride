import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UserProfile } from "./UserProfile";

export function AppHeader() {
    return (
        <header className="bg-surface fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b px-6">
            <div className="flex items-center gap-2">
                <div className="bg-accent text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md border font-semibold text-white">
                    S
                </div>
                <span className="text-sm font-semibold">STRIDE</span>
            </div>
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
