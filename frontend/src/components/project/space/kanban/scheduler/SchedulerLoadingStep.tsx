import { Modal, Spinner } from '@heroui/react'

export function SchedulerLoadingStep() {
    return (
        <>
            <Modal.Header>
                <Modal.Heading>Assigning tasks</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex min-h-52 items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Spinner size="lg" />
                    <div className="space-y-1">
                        <p className="text-foreground text-sm font-medium">
                            Scheduler is assigning tasks...
                        </p>
                    </div>
                </div>
            </Modal.Body>
        </>
    )
}
