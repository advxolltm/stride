import { Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type {
    SchedulerAssignment,
    SchedulerMemberOption,
    SchedulerPreviewResponse,
    SchedulerTaskOption,
} from './types'
import { SchedulerAssignmentRow } from './SchedulerAssignmentRow'

interface SchedulerReviewStepProps {
    preview: SchedulerPreviewResponse
    tasks: SchedulerTaskOption[]
    members: SchedulerMemberOption[]
    isConfirming: boolean
    onCancel: () => void
    onAssignmentChange: (taskId: string, userId: string) => void
	onAssignmentRemove: (taskId: string, userId: string) => void
    onConfirm: () => Promise<void>
}

export function SchedulerReviewStep({
    preview,
    tasks,
    members,
    isConfirming,
    onCancel,
    onAssignmentChange,
	onAssignmentRemove,
    onConfirm,
}: SchedulerReviewStepProps) {
    const { t } = useTranslation('space')
    const assignments = [
        ...preview.newAssignments,
        ...preview.changedAssignments,
        ...preview.incompatibleAssignments,
    ];
    const hasAssignments = assignments.length > 0
    const onlyInvalidAssignments = assignments.length == preview.incompatibleAssignments.length
    // const hasUnknownAssignee = assignments.some(
    //     (assignment) =>
    //         !members.some((member) => member.id === assignment.userId),
    // )

    function renderAssignmentSection(
        titleKey: string,
        emptyKey: string,
        sectionAssignments: SchedulerAssignment[],
    ) {
        return (
            <section className="space-y-3">
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                        {t(titleKey, { count: sectionAssignments.length })}
                    </h3>
                    {sectionAssignments.length === 0 ? (
                        <p className="text-sm text-default-500">
                            {t(emptyKey)}
                        </p>
                    ) : null}
                </div>
                {sectionAssignments.map((assignment) => {
                    const task = tasks.find((item) => item.id === assignment.taskId)
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
							onRemove={onAssignmentRemove}
                        />
                    )
                })}
            </section>
        )
    }

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
                    <>
                        {renderAssignmentSection(
                            'tasks.scheduler.review.newAssignments',
                            'tasks.scheduler.review.newAssignmentsEmpty',
                            preview.newAssignments,
                        )}
                        {renderAssignmentSection(
                            'tasks.scheduler.review.changedAssignments',
                            'tasks.scheduler.review.changedAssignmentsEmpty',
                            preview.changedAssignments,
                        )}
                        {renderAssignmentSection(
                            'tasks.scheduler.review.incompatibleAssignments',
                            'tasks.scheduler.review.incompatibleAssignmentsEmpty',
                            preview.incompatibleAssignments,
                        )}
                    </>
                ) : (
                    <div className="border-default-200 bg-content1 rounded-xl border p-4 text-sm text-default-600">
                        {t('tasks.scheduler.review.emptyHint')}
                    </div>
                )}
				{/*
                {hasAssignments && hasUnknownAssignee ? (
                    <div className="border-danger-200 bg-danger-50 text-danger-700 rounded-xl border p-4 text-sm">
                        {t('tasks.scheduler.review.invalidAssignments')}
                    </div>
                ) : null}
				*/}
            </Modal.Body>
            <Modal.Footer>
                <Button
                    variant="ghost"
                    onPress={onCancel}
                    isDisabled={isConfirming}
                >
                    {t('tasks.scheduler.actions.cancel')}
                </Button>
                {hasAssignments && !onlyInvalidAssignments ? (
                    <Button
                        onPress={onConfirm}
                        isPending={isConfirming}
                        isDisabled={false}
                    >
                        {t('tasks.scheduler.actions.confirm')}
                    </Button>
                ) : null}
            </Modal.Footer>
        </>
    )
}
