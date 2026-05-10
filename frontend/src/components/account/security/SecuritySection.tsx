import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Spinner, toast } from '@heroui/react'
import PasswordInput from '../../auth/PasswordInput'
import { useChangePasswordMutation } from '../../../store/features/user/user.api'
import { getApiErrorMessage } from '../../../shared/utils/api/errors'
import { useAppSelector } from '../../../shared/hooks/redux'
import { selectUserId } from '../../../store/userSlice'
import {
    passwordMinLength,
    validateStrongPassword,
} from '../../../shared/utils/passwordValidation'

const initialForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
}

export function SecuritySection() {
    const { t } = useTranslation('setting')
    const userId = useAppSelector(selectUserId)
    const [changePassword, { isLoading }] = useChangePasswordMutation()
    const [form, setForm] = useState(initialForm)

    const isChanged =
        form.currentPassword !== '' ||
        form.newPassword !== '' ||
        form.confirmPassword !== ''

    const handleReset = () => {
        setForm(initialForm)
    }

    const handleUpdate = async () => {
        if (!userId || !isChanged || isLoading) return

        if (form.newPassword !== form.confirmPassword) {
            toast.danger(t('security.passwordMismatch'))
            return
        }
        const passwordValidation = validateStrongPassword(form.newPassword)
        if (!passwordValidation.isValid) {
            toast.danger(
                t(`security.${passwordValidation.error}`, {
                    count: passwordMinLength,
                }),
            )
            return
        }

        try {
            await changePassword({
                id: userId,
                body: {
                    current_password: form.currentPassword,
                    new_password: form.newPassword,
                },
            }).unwrap()
            setForm(initialForm)
            toast.success(t('security.updateSuccess'))
        } catch (error: unknown) {
            toast.danger(getApiErrorMessage(error, t('security.updateError')))
        }
    }

    return (
        <div className="relative flex flex-col gap-6">
            {isLoading && (
                <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center rounded-lg">
                    <Spinner size="md" />
                </div>
            )}

            <div className="border-border bg-surface rounded-xl border p-6">
                <div className="mb-6">
                    <h2 className="font-semibold">{t('security.title')}</h2>
                    <p className="text-muted-foreground text-sm">
                        {t('security.description')}
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    <PasswordInput
                        label={t('security.currentPassword')}
                        value={form.currentPassword}
                        onChange={(value) =>
                            setForm({ ...form, currentPassword: value })
                        }
                        placeholder={t('security.currentPasswordPlaceholder')}
                        autoComplete="current-password"
                        variant="secondary"
                    />

                    <PasswordInput
                        label={t('security.newPassword')}
                        value={form.newPassword}
                        onChange={(value) =>
                            setForm({ ...form, newPassword: value })
                        }
                        placeholder={t('security.newPasswordPlaceholder')}
                        autoComplete="new-password"
                        variant="secondary"
                    />

                    <PasswordInput
                        label={t('security.confirmPassword')}
                        value={form.confirmPassword}
                        onChange={(value) =>
                            setForm({ ...form, confirmPassword: value })
                        }
                        placeholder={t('security.confirmPasswordPlaceholder')}
                        name="confirmPassword"
                        autoComplete="off"
                        variant="secondary"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <Button
                    variant="ghost"
                    isDisabled={!isChanged || isLoading}
                    onPress={handleReset}
                >
                    {t('security.reset')}
                </Button>
                <Button
                    isDisabled={!isChanged || isLoading}
                    onPress={handleUpdate}
                >
                    {t('security.update')}
                </Button>
            </div>
        </div>
    )
}
