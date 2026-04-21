import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import PasswordField from './PasswordField'
import { Button } from '@heroui/react'

export function SecuritySection() {
    const { t } = useTranslation('setting')

    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })

    return (
        <div className="relative flex flex-col gap-6">
            <div className="border-border bg-surface rounded-xl border p-6">
                <div className="mb-6">
                    <h2 className="font-semibold">{t('security.title')}</h2>
                    <p className="text-muted-foreground text-sm">
                        {t('security.description')}
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    <PasswordField
                        label={t('security.currentPassword')}
                        value={form.currentPassword}
                        onChange={(value) =>
                            setForm({ ...form, currentPassword: value })
                        }
                        placeholder={t('security.currentPasswordPlaceholder')}
                    />

                    <PasswordField
                        label={t('security.newPassword')}
                        value={form.newPassword}
                        onChange={(value) =>
                            setForm({ ...form, newPassword: value })
                        }
                        placeholder={t('security.newPasswordPlaceholder')}
                    />

                    <PasswordField
                        label={t('security.confirmPassword')}
                        value={form.confirmPassword}
                        onChange={(value) =>
                            setForm({ ...form, confirmPassword: value })
                        }
                        placeholder={t('security.confirmPasswordPlaceholder')}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <Button variant="ghost">{t('security.reset')}</Button>
                <Button>{t('security.update')}</Button>
            </div>
        </div>
    )
}
