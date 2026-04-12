import { Button, Modal } from '@heroui/react'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    title: string
    message: ReactNode
    confirmLabel: string
    cancelLabel?: string
    confirmVariant?: 'primary' | 'danger'
    onConfirm: () => void
}

export function ConfirmDialog({
    isOpen,
    onOpenChange,
    title,
    message,
    confirmLabel,
    cancelLabel = 'Cancel',
    confirmVariant = 'primary',
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
                                onPress={() => onOpenChange(false)}
                            >
                                {cancelLabel}
                            </Button>
                            <Button
                                variant={
                                    confirmVariant === 'danger'
                                        ? 'danger'
                                        : 'primary'
                                }
                                onPress={() => {
                                    onConfirm()
                                    onOpenChange(false)
                                }}
                            >
                                {confirmLabel}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
