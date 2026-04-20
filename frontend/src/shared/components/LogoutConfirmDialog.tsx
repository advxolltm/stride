import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '../hooks/redux'
import { useLogoutMutation } from '../../store/features/auth/auth.api'
import { baseApi } from '../../store/api/base.api'
import { getApiErrorMessage } from '../utils/api/errors'
import { ConfirmDialog } from './ConfirmDialog'

interface LogoutConfirmDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function LogoutConfirmDialog({
    isOpen,
    onOpenChange,
}: LogoutConfirmDialogProps) {
    const { t } = useTranslation('common')
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const [logoutUser, { isLoading: isLoggingOut }] = useLogoutMutation()
    const [logoutError, setLogoutError] = useState<string | null>(null)

    const handleLogout = async () => {
        setLogoutError(null)

        try {
            await logoutUser().unwrap()
            onOpenChange(false)
            dispatch(baseApi.util.resetApiState())
            navigate('/login', { replace: true })
        } catch (error: unknown) {
            setLogoutError(
                getApiErrorMessage(
                    error,
                    'Failed to sign out. Please try again.',
                ),
            )
        }
    }

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={t('logout.title')}
            message={
                <>
                    <span>{t('logout.message')}</span>
                    {logoutError ? (
                        <span className="mt-2 block text-sm text-red-500">
                            {logoutError}
                        </span>
                    ) : null}
                </>
            }
            confirmLabel={t('logout.confirm')}
            pendingConfirmLabel={t('logout.pending')}
            cancelLabel={t('actions.cancel')}
            isConfirmPending={isLoggingOut}
            closeOnConfirm={false}
            onConfirm={handleLogout}
        />
    )
}
