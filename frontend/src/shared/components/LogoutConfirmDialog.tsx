import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '../hooks/redux'
import { logout } from '../../store/features/auth/auth.slice'
import { clearAuthState } from '../../store/features/auth/auth.storage'
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
    const dispatch = useAppDispatch()
    const { t } = useTranslation('common')
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const handleLogout = async () => {
        setIsLoggingOut(true)
        await new Promise((resolve) => setTimeout(resolve, 350))
        dispatch(logout())
        clearAuthState()
        onOpenChange(false)
        setIsLoggingOut(false)
        navigate('/login', { replace: true })
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
