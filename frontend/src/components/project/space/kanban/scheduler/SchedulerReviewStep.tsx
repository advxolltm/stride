import { Button, Modal } from '@heroui/react'
import type { SchedulerAssignment, SchedulerMemberOption, SchedulerTaskOption } from './types'
import { SchedulerAssignmentRow } from './SchedulerAssignmentRow'

interface SchedulerReviewStepProps {
    assignments: SchedulerAssignment[]
    tasks: SchedulerTaskOption[]
    members: SchedulerMemberOption[]
    onCancel: () => void
    onAssignmentChange: (taskId: string, userId: string) => void
    onConfirm: () => void
}

export function SchedulerReviewStep({
    assignments,
    tasks,
    members,
    onCancel,
    onAssignmentChange,
    onConfirm,
}: SchedulerReviewStepProps) {
    return (
        <>
            <Modal.Header>
                <div className="space-y-1">
                    <Modal.Heading>Review assignments</Modal.Heading>
                    <p className="text-default-500 text-sm">
                        Adjust any assignee before confirming. {assignments.length}{' '}
                        tasks ready.
                    </p>
                </div>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-2">
                {assignments.map((assignment) => {
                    const task = tasks.find(
                        (item) => item.id === assignment.task_id,
                    )

                    if (!task) {
                        return null
                    }

                    return (
                        <SchedulerAssignmentRow
                            key={assignment.task_id}
                            assignment={assignment}
                            task={task}
                            members={members}
                            onChange={onAssignmentChange}
                        />
                    )
                })}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="ghost" onPress={onCancel}>
                    Cancel
                </Button>
                <Button onPress={onConfirm}>Confirm assignments</Button>
            </Modal.Footer>
        </>
    )
}
