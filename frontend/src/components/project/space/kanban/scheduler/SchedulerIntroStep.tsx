import { Button, Modal } from '@heroui/react'
import { Sparkles } from 'lucide-react'

interface SchedulerIntroStepProps {
    taskCount: number
    onCancel: () => void
    onRun: () => void
}

export function SchedulerIntroStep({
    taskCount,
    onCancel,
    onRun,
}: SchedulerIntroStepProps) {
    return (
        <>
            <Modal.Header>
                <div className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                        <Sparkles size={18} />
                    </div>
                    <div className="space-y-1">
                        <Modal.Heading>Auto-assign tasks?</Modal.Heading>
                        <p className="text-default-500 text-sm">
                            The scheduler will distribute {taskCount} open tasks
                            across your team based on workload. You&apos;ll be
                            able to review and adjust before confirming.
                        </p>
                    </div>
                </div>
            </Modal.Header>
            <Modal.Footer>
                <Button variant="ghost" onPress={onCancel}>
                    Cancel
                </Button>
                <Button onPress={onRun}>Run scheduler</Button>
            </Modal.Footer>
        </>
    )
}
