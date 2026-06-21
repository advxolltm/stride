import { FieldError, Input, Label, TextField } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { ProfileForm } from './ProfileSection'

interface ProfileDetailsFormProps {
    form: ProfileForm
    onChange: (form: ProfileForm) => void
}

export function ProfileDetailsForm({
    form,
    onChange,
}: Readonly<ProfileDetailsFormProps>) {
    const { t } = useTranslation('setting')

    return (
        <div className="border-border bg-surface rounded-xl border p-6">
            <h2 className="mb-4 font-semibold">{t('profile.title')}</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                    value={form.fullName}
                    onChange={(value) => onChange({ ...form, fullName: value })}
                >
                    <Label>{t('profile.fullName')}</Label>
                    <Input className="p-3" variant="secondary" />
                    <FieldError />
                </TextField>

                <TextField isReadOnly value={form.username}>
                    <Label>{t('profile.username')}</Label>
                    <Input className="p-3" variant="secondary" />
                    <FieldError />
                </TextField>
            </div>

            <div className="mt-4">
                <TextField
                    value={form.email}
                    onChange={(value) => onChange({ ...form, email: value })}
                >
                    <Label>{t('profile.email')}</Label>
                    <Input className="p-3" type="email" variant="secondary" />
                    <FieldError />
                </TextField>
            </div>
        </div>
    )
}
