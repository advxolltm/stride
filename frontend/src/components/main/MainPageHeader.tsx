import { Button } from '@heroui/react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface MainPageHeaderProps {
    title: string
    description: string
    onCreateProject?: () => void
}

export function MainPageHeader({
    title,
    description,
    onCreateProject,
}: MainPageHeaderProps) {
    const { t } = useTranslation('common')

    return (
        <div className="mb-6 flex items-start justify-between gap-4">
            <div>
                <h1 className="text-[20px] font-bold text-[var(--foreground)]">
                    {title}
                </h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                    {description}
                </p>
            </div>

            {onCreateProject ? (
                <Button
                    variant="primary"
                    onPress={onCreateProject}
                    className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] shadow-sm hover:opacity-90"
                >
                    <span className="flex items-center gap-2">
                        <Plus size={15} />
                        <span>{t('actions.createProject')}</span>
                    </span>
                </Button>
            ) : null}
        </div>
    )
}
