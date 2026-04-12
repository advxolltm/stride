import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ConfirmDialog } from './ConfirmDialog'

interface LogoutConfirmDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function LogoutConfirmDialog({
    isOpen,
    onOpenChange,
}: LogoutConfirmDialogProps) {
    const navigate = useNavigate()
    const { t } = useTranslation('common')
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const handleLogout = async () => {
        setIsLoggingOut(true)
        await new Promise((resolve) => setTimeout(resolve, 350))
        navigate('/login')
    }

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={t('logout.title')}
            message={t('logout.message')}
            confirmLabel={t('logout.confirm')}
            pendingConfirmLabel={t('logout.pending')}
            cancelLabel={t('actions.cancel')}
            isConfirmPending={isLoggingOut}
            closeOnConfirm={false}
            onConfirm={handleLogout}
        />
    )
}
