import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

interface LanguageSwitcherProps {
    className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
    const { i18n } = useTranslation()

    const changeLanguage = (lang: string) => {
        i18n.changeLanguage(lang)
        localStorage.setItem('lang', lang)
    }

    return (
        <span className="relative inline-flex">
            <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                aria-label="Language"
                className={clsx(
                    'bg-surface text-foreground border-border focus:ring-accent hover:bg-surface-secondary cursor-pointer appearance-none rounded-md border py-1.5 pr-8 pl-3 text-sm transition focus:ring-2 focus:outline-none',
                    className,
                )}
            >
                <option value="en" className="bg-surface text-foreground">
                    🇬🇧 EN
                </option>
                <option value="de" className="bg-surface text-foreground">
                    🇩🇪 DE
                </option>
            </select>
            <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-[var(--foreground)]"
                strokeWidth={2}
            />
        </span>
    )
}
