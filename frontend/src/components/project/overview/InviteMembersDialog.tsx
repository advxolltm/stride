'use client'

import { Button, Input, Modal } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface InviteMembersDialogProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
}
export function InviteMembersDialog({
    isOpen,
    setIsOpen,
}: Readonly<InviteMembersDialogProps>) {
    const { t } = useTranslation('project')
    const [emails, setEmails] = useState('')

    const handleSendInvite = () => {
        console.log('Inviting:', emails)
    }

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)

        if (!open) {
            setEmails('')
        }
    }

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Container size="lg">
                <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{t('header.invite')}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                        <p className="text-sm text-gray-500">
                            {t('inviteDialog.description')}
                        </p>
                        <div className="mt-2 flex flex-col gap-4 p-1">
                            <Input
                                placeholder={t('inviteDialog.emailPlaceholder')}
                                value={emails}
                                onChange={(e) => setEmails(e.target.value)}
                                type="email"
                                className="p-3"
                                variant="secondary"
                            />

                            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                                <span className="truncate">
                                    https://app.stride.io/invite/abc123
                                </span>
                                {t('inviteDialog.send')}
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            onPress={handleSendInvite}
                            isDisabled={!emails.trim()}
                        >
                            {t('inviteDialog.send')}
                        </Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    )
}
