import { Button, Modal } from '@heroui/react'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    title: string
    message: ReactNode
    confirmLabel: string
    pendingConfirmLabel?: string
    cancelLabel?: string
    confirmVariant?: 'primary' | 'danger'
    isConfirmPending?: boolean
    closeOnConfirm?: boolean
    onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
    isOpen,
    onOpenChange,
    title,
    message,
    confirmLabel,
    pendingConfirmLabel,
    cancelLabel = 'Cancel',
    confirmVariant = 'primary',
    isConfirmPending = false,
    closeOnConfirm = true,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{title}</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            <p className="text-muted text-sm">{message}</p>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                variant="ghost"
                                isDisabled={isConfirmPending}
                                onPress={() => onOpenChange(false)}
                            >
                                {cancelLabel}
                            </Button>
                            <Button
                                isPending={isConfirmPending}
                                variant={
                                    confirmVariant === 'danger'
                                        ? 'danger'
                                        : 'primary'
                                }
                                onPress={async () => {
                                    await onConfirm()

                                    if (closeOnConfirm) {
                                        onOpenChange(false)
                                    }
                                }}
                            >
                                {isConfirmPending
                                    ? pendingConfirmLabel || confirmLabel
                                    : confirmLabel}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
