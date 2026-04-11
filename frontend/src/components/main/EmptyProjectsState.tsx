import { Button, Card } from '@heroui/react'
import { FolderKanban, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface EmptyProjectsStateProps {
    onCreateProject?: () => void
}

export function EmptyProjectsState({
    onCreateProject,
}: EmptyProjectsStateProps) {
    const { t } = useTranslation(['project', 'common'])

    return (
        <Card className="relative overflow-hidden border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="relative flex min-h-[22rem] flex-col items-center justify-center px-6 py-12 text-center sm:px-10">
                <div className="relative mb-6 flex h-36 w-36 items-center justify-center">
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 opacity-55"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--border) 75%, transparent) 1px, transparent 0)',
                            backgroundSize: '16px 16px',
                            backgroundPosition: 'center',
                        }}
                    />

                    <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                        <FolderKanban size={30} strokeWidth={2} />
                    </div>
                </div>

                <h2 className="max-w-lg text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
                    {t('emptyState.title')}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
                    {t('emptyState.description')}
                </p>

                <Button
                    variant="primary"
                    onPress={onCreateProject}
                    className="mt-6 h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <span className="flex items-center gap-2">
                        <Plus size={15} />
                        <span>{t('common:actions.createProject')}</span>
                    </span>
                </Button>
            </div>
        </Card>
    )
}
