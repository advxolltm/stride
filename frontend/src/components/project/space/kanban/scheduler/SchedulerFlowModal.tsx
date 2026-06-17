import { Modal } from '@heroui/react'
import { useEffect, useState } from 'react'
import type {
    SchedulerAssignment,
    SchedulerMemberOption,
    SchedulerTaskOption,
} from './types'
import { SchedulerIntroStep } from './SchedulerIntroStep'
import { SchedulerLoadingStep } from './SchedulerLoadingStep'
import { SchedulerReviewStep } from './SchedulerReviewStep'

type SchedulerStep = 'intro' | 'loading' | 'review'

interface SchedulerFlowModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    tasks: SchedulerTaskOption[]
    members: SchedulerMemberOption[]
    schedulableMemberCount: number
    skippedMemberCount: number
    estimatedTaskCount: number
    onRun: () => Promise<SchedulerAssignment[]>
    onConfirm: (assignments: SchedulerAssignment[]) => Promise<void>
}

export function SchedulerFlowModal({
    isOpen,
    onOpenChange,
    tasks,
    members,
    schedulableMemberCount,
    skippedMemberCount,
    estimatedTaskCount,
    onRun,
    onConfirm,
}: SchedulerFlowModalProps) {
    const [step, setStep] = useState<SchedulerStep>('intro')
    const [assignments, setAssignments] = useState<SchedulerAssignment[]>([])
    const [isConfirming, setIsConfirming] = useState(false)

    function resetFlowState() {
        setStep('intro')
        setAssignments([])
        setIsConfirming(false)
    }

    function handleOpenChange(nextOpen: boolean) {
        if (!nextOpen) {
            resetFlowState()
        }

        onOpenChange(nextOpen)
    }

    useEffect(() => {
        if (step !== 'loading') {
            return
        }

        let isMounted = true

        void onRun()
            .then((nextAssignments) => {
                if (!isMounted) return

                setAssignments(nextAssignments)
                setStep('review')
            })
            .catch(() => {
                if (!isMounted) return

                resetFlowState()
                onOpenChange(false)
            })

        return () => {
            isMounted = false
        }
    }, [onOpenChange, onRun, step])

    function handleAssignmentChange(taskId: string, userId: string) {
        setAssignments((current) =>
            current.map((assignment) =>
                assignment.taskId === taskId
                    ? { ...assignment, userId }
                    : assignment,
            ),
        )
    }

    async function handleConfirm() {
        setIsConfirming(true)

        try {
            await onConfirm(assignments)
            handleOpenChange(false)
        } finally {
            setIsConfirming(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Backdrop>
                <Modal.Container placement="auto">
                    <Modal.Dialog className="sm:max-w-xl">
                        {step === 'intro' ? (
                            <SchedulerIntroStep
                                taskCount={tasks.length}
                                schedulableMemberCount={schedulableMemberCount}
                                skippedMemberCount={skippedMemberCount}
                                estimatedTaskCount={estimatedTaskCount}
                                onCancel={() => handleOpenChange(false)}
                                onRun={() => setStep('loading')}
                            />
                        ) : null}

                        {step === 'loading' ? <SchedulerLoadingStep /> : null}

                        {step === 'review' ? (
                            <SchedulerReviewStep
                                assignments={assignments}
                                tasks={tasks}
                                members={members}
                                isConfirming={isConfirming}
                                onCancel={() => handleOpenChange(false)}
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
