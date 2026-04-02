import { useTranslation } from 'react-i18next'

function LanguageSwitcher() {
    const { i18n } = useTranslation()

    const changeLanguage = (lang: string) => {
        i18n.changeLanguage(lang)
        localStorage.setItem('lang', lang)
    }

    return (
        <select
            value={i18n.language}
            onChange={(e) => changeLanguage(e.target.value)}
            className="bg-surface text-foreground border-border focus:ring-accent hover:bg-surface-secondary cursor-pointer rounded-md border px-3 py-1.5 text-sm transition focus:ring-2 focus:outline-none"
        >
            <option value="en" className="bg-surface text-foreground">
                🇬🇧 EN
            </option>
            <option value="de" className="bg-surface text-foreground">
                🇩🇪 DE
            </option>
        </select>
    )
}

export default LanguageSwitcher
