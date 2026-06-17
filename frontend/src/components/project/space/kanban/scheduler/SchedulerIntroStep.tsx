import { Button, Modal } from '@heroui/react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SchedulerIntroStepProps {
    taskCount: number
    schedulableMemberCount: number
    skippedMemberCount: number
    estimatedTaskCount: number
    startDateTaskCount: number
    onCancel: () => void
    onRun: () => void
}

export function SchedulerIntroStep({
    taskCount,
    schedulableMemberCount,
    skippedMemberCount,
    estimatedTaskCount,
    startDateTaskCount,
    onCancel,
    onRun,
}: SchedulerIntroStepProps) {
    const { t } = useTranslation('space')
    const hasTasks = taskCount > 0
    const hasSchedulableMembers = schedulableMemberCount > 0
    const hasEstimatedTasks = estimatedTaskCount > 0
    const hasStartDateTasks = startDateTaskCount > 0
    const canRun =
        hasTasks &&
        hasSchedulableMembers &&
        hasEstimatedTasks &&
        hasStartDateTasks
    const validationMessage = !hasTasks
        ? t('tasks.scheduler.intro.noTasks')
        : !hasSchedulableMembers
          ? t('tasks.scheduler.intro.noMembers')
          : !hasEstimatedTasks
            ? t('tasks.scheduler.intro.noEstimatedTasks')
            : !hasStartDateTasks
              ? t('tasks.scheduler.intro.noStartDates')
          : null

    const description = canRun
        ? t('tasks.scheduler.intro.ready', {
                taskCount,
                count: schedulableMemberCount,
            })
        : t('tasks.scheduler.intro.help')

    return (
        <>
            <Modal.Header>
                <div className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                        <Sparkles size={18} />
                    </div>
                    <div className="space-y-1">
                        <Modal.Heading>
                            {t('tasks.scheduler.intro.title')}
                        </Modal.Heading>
                        <p className="text-default-500 text-sm">{description}</p>
                        {validationMessage ? (
                            <div className="border-warning-200 bg-warning-50 text-warning-800 rounded-xl border px-3 py-2 text-sm">
                                {validationMessage}
                            </div>
                        ) : null}
                        {canRun && skippedMemberCount > 0 ? (
                            <div className="border-default-200 bg-content1 text-default-700 rounded-xl border px-3 py-2 text-sm">
                                {t('tasks.scheduler.intro.skippedMembers', {
                                    count: skippedMemberCount,
                                })}
                            </div>
                        ) : null}
                    </div>
                </div>
            </Modal.Header>
            <Modal.Footer>
                <Button variant="ghost" onPress={onCancel}>
                    {t('tasks.scheduler.actions.cancel')}
                </Button>
                <Button onPress={onRun} isDisabled={!canRun}>
                    {t('tasks.scheduler.actions.run')}
                </Button>
            </Modal.Footer>
        </>
    )
}
