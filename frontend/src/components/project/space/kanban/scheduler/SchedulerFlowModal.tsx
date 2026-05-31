import { Modal } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import type { SchedulerAssignment, SchedulerConfirmRequest, SchedulerMemberOption, SchedulerTaskOption } from './types'
import { buildMockSchedulerAssignments, buildSchedulerTriggerRequest } from './mockScheduler'
import { SchedulerIntroStep } from './SchedulerIntroStep'
import { SchedulerLoadingStep } from './SchedulerLoadingStep'
import { SchedulerReviewStep } from './SchedulerReviewStep'

type SchedulerStep = 'intro' | 'loading' | 'review'

interface SchedulerFlowModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    tasks: SchedulerTaskOption[]
    members: SchedulerMemberOption[]
    onConfirm: (assignments: SchedulerConfirmRequest) => void
}

export function SchedulerFlowModal({
    isOpen,
    onOpenChange,
    tasks,
    members,
    onConfirm,
}: SchedulerFlowModalProps) {
    const [step, setStep] = useState<SchedulerStep>('intro')
    const [assignments, setAssignments] = useState<SchedulerAssignment[]>([])

    const triggerPayload = useMemo(
        () => buildSchedulerTriggerRequest(tasks, members),
        [members, tasks],
    )

    useEffect(() => {
        if (!isOpen) {
            setStep('intro')
            setAssignments([])
        }
    }, [isOpen])

    useEffect(() => {
        if (step !== 'loading') {
            return
        }

        const timeoutId = window.setTimeout(() => {
            setAssignments(
                buildMockSchedulerAssignments(triggerPayload, members),
            )
            setStep('review')
        }, 1200)

        return () => window.clearTimeout(timeoutId)
    }, [members, step, triggerPayload])

    function handleAssignmentChange(taskId: string, userId: string) {
        setAssignments((current) =>
            current.map((assignment) =>
                assignment.task_id === taskId
                    ? { ...assignment, user_id: userId }
                    : assignment,
            ),
        )
    }

    function handleConfirm() {
        onConfirm(assignments)
        onOpenChange(false)
    }

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container placement="auto">
                    <Modal.Dialog className="sm:max-w-xl">
                        <Modal.CloseTrigger />
                        {step === 'intro' ? (
                            <SchedulerIntroStep
                                taskCount={tasks.length}
                                onCancel={() => onOpenChange(false)}
                                onRun={() => setStep('loading')}
                            />
                        ) : null}

                        {step === 'loading' ? <SchedulerLoadingStep /> : null}

                        {step === 'review' ? (
                            <SchedulerReviewStep
                                assignments={assignments}
                                tasks={tasks}
                                members={members}
                                onCancel={() => onOpenChange(false)}
                                onAssignmentChange={handleAssignmentChange}
                                onConfirm={handleConfirm}
                            />
                        ) : null}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
