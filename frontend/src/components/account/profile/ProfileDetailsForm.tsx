import { Button, FieldError, Input, Label, TextField } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const MOCK_USER = {
    fullName: 'John Doe',
    username: 'johndoe',
    email: 'john.doe@example.com',
}

export function ProfileDetailsForm() {
    const { t } = useTranslation('setting')

    const [form, setForm] = useState(MOCK_USER)

    return (
        <div className="border-border bg-surface rounded-xl border p-6">
            <h2 className="mb-4 font-semibold">{t('profile.title')}</h2>

            <div className="grid grid-cols-2 gap-4">
                <TextField
                    value={form.fullName}
                    onChange={(value) => setForm({ ...form, fullName: value })}
                >
                    <Label>{t('profile.fullName')}</Label>
                    <Input className="p-3" variant="secondary" />
                    <FieldError />
                </TextField>

                <TextField
                    value={form.username}
                    onChange={(value) => setForm({ ...form, username: value })}
                >
                    <Label>{t('profile.username')}</Label>
                    <Input className="p-3" variant="secondary" />
                    <FieldError />
                </TextField>
            </div>

            <div className="mt-4">
                <TextField
                    isReadOnly
                    value={form.email}
                    onChange={(value) => setForm({ ...form, email: value })}
                >
                    <Label>{t('profile.email')}</Label>
                    <Input className="p-3" type="email" variant="secondary" />
                    <FieldError />
                </TextField>
            </div>

            <div className="mt-6 flex justify-end">
                <Button>{t('profile.save')}</Button>
            </div>
        </div>
    )
}
