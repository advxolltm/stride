import { Modal } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import type {
    SchedulerAssignment,
    SchedulerMemberOption,
    SchedulerPreviewResponse,
    SchedulerTaskOption,
} from './types'
import { SchedulerIntroStep } from './SchedulerIntroStep'
import { SchedulerLoadingStep } from './SchedulerLoadingStep'
import { SchedulerReviewStep } from './SchedulerReviewStep'

type SchedulerStep = 'intro' | 'loading' | 'review'
export type OptimizationStrategy = 'distribute-evenly' | 'min-makespan'

interface SchedulerFlowModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    tasks: SchedulerTaskOption[]
    members: SchedulerMemberOption[]
    schedulableMemberCount: number
    skippedMemberCount: number
    estimatedTaskCount: number
    startDateTaskCount: number
    onRun: (optimStrat: OptimizationStrategy) => Promise<SchedulerPreviewResponse>
    onConfirm: (assignments: SchedulerAssignment[]) => Promise<void>
}

const EMPTY_SCHEDULER_PREVIEW: SchedulerPreviewResponse = {
    newAssignments: [],
    changedAssignments: [],
    incompatibleAssignments: [],
}

export function SchedulerFlowModal({
    isOpen,
    onOpenChange,
    tasks,
    members,
    schedulableMemberCount,
    skippedMemberCount,
    estimatedTaskCount,
    startDateTaskCount,
    onRun,
    onConfirm,
}: SchedulerFlowModalProps) {
    const [step, setStep] = useState<SchedulerStep>('intro')
    const [preview, setPreview] = useState<SchedulerPreviewResponse>(
        EMPTY_SCHEDULER_PREVIEW,
    )
    const [isConfirming, setIsConfirming] = useState(false)
    const hasStartedRunRef = useRef(false)
    const onRunRef = useRef(onRun)
    const onOpenChangeRef = useRef(onOpenChange)
    const [strategy, setStrategy] = useState<OptimizationStrategy>('min-makespan')
    const [timeout, setTimeout] = useState<number>(45)

    useEffect(() => {
        onRunRef.current = onRun
    }, [onRun])

    useEffect(() => {
        onOpenChangeRef.current = onOpenChange
    }, [onOpenChange])

    function resetFlowState() {
        hasStartedRunRef.current = false
        setStep('intro')
        setPreview(EMPTY_SCHEDULER_PREVIEW)
        setIsConfirming(false)
    }

    function handleOpenChange(nextOpen: boolean) {
        if (!nextOpen) {
            resetFlowState()
        }

        onOpenChange(nextOpen)
    }

    useEffect(() => {
        if (step !== 'loading' || hasStartedRunRef.current) {
            return
        }

        hasStartedRunRef.current = true
        let isMounted = true

        void onRunRef.current(strategy, timeout)
            .then((nextPreview) => {
                if (!isMounted) return

                setPreview(nextPreview)
                setStep('review')
            })
            .catch(() => {
                if (!isMounted) return

                resetFlowState()
                onOpenChangeRef.current(false)
            })

        return () => {
            isMounted = false
        }
    }, [step])

    function handleAssignmentRemove(taskId: string, userId: string) {
        function updateAssignments(assignments: SchedulerAssignment[]) {
            return assignments.map(assignment => {
                if (assignment.taskId === taskId && assignment.userId === userId) {
                    return { taskId: assignment.taskId, userId: null };
                } else {
                    return assignment;
                }
            });
        }

        setPreview((current) => {
            const isDropped = current.incompatibleAssignments.some(
                (assignment) => assignment.taskId === taskId
            );

            if (isDropped) {
                return {
                    newAssignments: current.newAssignments,
                    changedAssignments: [
                        ...current.changedAssignments,
                        { taskId, userId: null },
                    ],
                    incompatibleAssignments: current.incompatibleAssignments.filter(
                        (assignment) => assignment.taskId !== taskId
                    ),
                }
            }

            return {
                newAssignments: updateAssignments(current.newAssignments),
                changedAssignments: updateAssignments(current.changedAssignments),
                incompatibleAssignments: updateAssignments(current.incompatibleAssignments),
            };
        })
    }

    function handleAssignmentChange(taskId: string, userId: string) {
        function updateAssignments(assignments: SchedulerAssignment[]) {
            return assignments.map((assignment) =>
                assignment.taskId === taskId
                    ? { ...assignment, userId }
                    : assignment,
            )
        }

        setPreview((current) => {
            const isDropped = current.incompatibleAssignments.some(
                (assignment) => assignment.taskId === taskId
            )

            if (isDropped) {
                return {
                    newAssignments: current.newAssignments,
                    changedAssignments: [
                        ...current.changedAssignments,
                        { taskId, userId },
                    ],
                    incompatibleAssignments: current.incompatibleAssignments.filter(
                        (assignment) => assignment.taskId !== taskId
                    ),
                }
            }

            return {
                newAssignments: updateAssignments(current.newAssignments),
                changedAssignments: updateAssignments(current.changedAssignments),
                incompatibleAssignments: current.incompatibleAssignments,
            }
        })
    }

    async function handleConfirm() {
        setIsConfirming(true)

        try {
            await onConfirm([
                ...preview.newAssignments,
                ...preview.changedAssignments,
                ...preview.incompatibleAssignments,
            ])
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
                                startDateTaskCount={startDateTaskCount}
                                onCancel={() => handleOpenChange(false)}
                                onRun={() => setStep('loading')}
                                onStrategyChange={(val) => setStrategy(val as OptimizationStrategy)}
                                strategy={strategy}
                                timeout={timeout}
                                onTimeoutChange={(val) => setTimeout(val as number)}
                            />
                        ) : null}

                        {step === 'loading' ? <SchedulerLoadingStep /> : null}

                        {step === 'review' ? (
                            <SchedulerReviewStep
                                preview={preview}
                                tasks={tasks}
                                members={members}
                                isConfirming={isConfirming}
                                onCancel={() => handleOpenChange(false)}
                                onAssignmentChange={handleAssignmentChange}
                                onAssignmentRemove={handleAssignmentRemove}
                                onConfirm={handleConfirm}
                            />
                        ) : null}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
