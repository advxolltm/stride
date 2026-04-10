import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher'
import { ThemeSwitcher } from '../components/layout/ThemeSwitcher'

export function HomePage() {
    const { t } = useTranslation()

    return (
        <div className="bg-background text-foreground min-h-screen p-6 transition-colors">
            <div className="mx-auto max-w-xl space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">{t('title')}</h1>

                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <ThemeSwitcher />
                    </div>
                </div>

                <div className="rounded-base border-border bg-surface border p-4">
                    <h2 className="text-lg font-semibold">{t('cardTitle')}</h2>
                    <p className="text-muted">{t('cardDescription')}</p>
                </div>

                <div className="flex gap-3">
                    <Button>{t('primary')}</Button>
                    <Button>{t('danger')}</Button>
                </div>

                <div className="rounded-base bg-primary text-primary-foreground p-3">
                    {t('tailwindMessage')}
                </div>
            </div>
        </div>
    )
}
