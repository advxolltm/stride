import { Modal, Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

export function SchedulerLoadingStep() {
    const { t } = useTranslation('space')
    return (
        <>
            <Modal.Header>
                <Modal.Heading>{t('tasks.scheduler.loading.title')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex min-h-52 items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Spinner size="lg" />
                    <div className="space-y-1">
                        <p className="text-foreground text-sm font-medium">
                            {t('tasks.scheduler.loading.description')}
                        </p>
                    </div>
                </div>
            </Modal.Body>
        </>
    )
}
