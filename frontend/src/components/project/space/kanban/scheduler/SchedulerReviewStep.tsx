import { Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { SchedulerAssignment, SchedulerMemberOption, SchedulerTaskOption } from './types'
import { SchedulerAssignmentRow } from './SchedulerAssignmentRow'

interface SchedulerReviewStepProps {
    assignments: SchedulerAssignment[]
    tasks: SchedulerTaskOption[]
    members: SchedulerMemberOption[]
    isConfirming: boolean
    onCancel: () => void
    onAssignmentChange: (taskId: string, userId: string) => void
    onConfirm: () => Promise<void>
}

export function SchedulerReviewStep({
    assignments,
    tasks,
    members,
    isConfirming,
    onCancel,
    onAssignmentChange,
    onConfirm,
}: SchedulerReviewStepProps) {
    const { t } = useTranslation('space')
    const hasAssignments = assignments.length > 0
    const hasUnknownAssignee = assignments.some(
        (assignment) =>
            !members.some((member) => member.id === assignment.userId),
    )

    return (
        <>
            <Modal.Header>
                <div className="space-y-1">
                    <Modal.Heading>
                        {hasAssignments
                            ? t('tasks.scheduler.review.title')
                            : t('tasks.scheduler.review.emptyTitle')}
                    </Modal.Heading>
                    <p className="text-default-500 text-sm">
                        {hasAssignments
                            ? t('tasks.scheduler.review.description', {
                                  count: assignments.length,
                              })
                            : t('tasks.scheduler.review.emptyDescription')}
                    </p>
                </div>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-2">
                {hasAssignments ? (
                    assignments.map((assignment) => {
                        const task = tasks.find(
                            (item) => item.id === assignment.taskId,
                        )

                        if (!task) {
                            return null
                        }

                        return (
                            <SchedulerAssignmentRow
                                key={assignment.taskId}
                                assignment={assignment}
                                task={task}
                                members={members}
                                onChange={onAssignmentChange}
                            />
                        )
                    })
                ) : (
                    <div className="border-default-200 bg-content1 rounded-xl border p-4 text-sm text-default-600">
                        {t('tasks.scheduler.review.emptyHint')}
                    </div>
                )}
                {hasAssignments && hasUnknownAssignee ? (
                    <div className="border-danger-200 bg-danger-50 text-danger-700 rounded-xl border p-4 text-sm">
                        {t('tasks.scheduler.review.invalidAssignments')}
                    </div>
                ) : null}
            </Modal.Body>
            <Modal.Footer>
                <Button
                    variant="ghost"
                    onPress={onCancel}
                    isDisabled={isConfirming}
                >
                    {t('tasks.scheduler.actions.cancel')}
                </Button>
                {hasAssignments ? (
                    <Button
                        onPress={onConfirm}
                        isPending={isConfirming}
                        isDisabled={hasUnknownAssignee}
                    >
                        {t('tasks.scheduler.actions.confirm')}
                    </Button>
                ) : null}
            </Modal.Footer>
        </>
    )
}
