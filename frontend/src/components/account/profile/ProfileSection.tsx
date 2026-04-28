import { Button, Spinner, toast } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
    useGetUserByIdQuery,
    useUpdateUserMutation,
} from '../../../store/features/user/user.api'
import type { ApiErrorResponse } from '../../../store/features/user/user.types'
import { ProfileAvatarUpload } from './ProfileAvatarUpload'
import { ProfileDetailsForm } from './ProfileDetailsForm'
import { useGetSessionQuery } from '../../../store/features/auth/auth.api'
import { isFetchBaseQueryError } from '../../../shared/utils/api/errors'

export type ProfileForm = {
    fullName: string
    username: string
    email: string
    avatarFile: File | null
}

export function ProfileSection() {
    const { t } = useTranslation('setting')

    const { data: sessionUser } = useGetSessionQuery()
    const { data: user } = useGetUserByIdQuery(sessionUser!.id)
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation()

    const [form, setForm] = useState<ProfileForm>({
        fullName: user?.fullName ?? '',
        username: user?.username ?? '',
        email: user?.email ?? '',
        avatarFile: null,
    })

    const isChanged =
        form.fullName.trim() !== (user?.fullName ?? '') ||
        form.email.trim() !== (user?.email ?? '') ||
        form.avatarFile !== null

    const handleReset = () => {
        setForm({
            fullName: user?.fullName ?? '',
            username: user?.username ?? '',
            email: user?.email ?? '',
            avatarFile: null,
        })
    }

    const handleSave = async () => {
        if (!isChanged || isUpdating) return

        const nextFullName = form.fullName.trim()
        const nextEmail = form.email.trim()

        const body = new FormData()
        if (nextFullName !== (user?.fullName ?? '')) {
            body.set('full_name', nextFullName)
        }
        if (nextEmail !== (user?.email ?? '')) {
            body.set('email', nextEmail)
        }
        if (form.avatarFile) {
            body.set('avatar', form.avatarFile)
        }

        try {
            await updateUser({ id: sessionUser!.id, body }).unwrap()
            toast.success(t('profile.updateSuccess'))
        } catch (error: unknown) {
            const message = isFetchBaseQueryError(error)
                ? (error.data as ApiErrorResponse).error
                : t('profile.updateError')
            toast.danger(message)
        }
    }

    return (
        <div className="relative flex flex-col gap-6">
            {isUpdating && (
                <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center rounded-lg">
                    <Spinner size="md" />
                </div>
            )}

            <ProfileAvatarUpload
                avatarUrl={user?.avatarUrl ?? null}
                avatarFile={form.avatarFile}
                onAvatarChange={(file) =>
                    setForm((prev) => ({ ...prev, avatarFile: file }))
                }
            />
            <ProfileDetailsForm form={form} onChange={setForm} />
            <div className="flex justify-end gap-3">
                <Button
                    variant="ghost"
                    isDisabled={!isChanged}
                    onPress={handleReset}
                >
                    {t('profile.reset')}
                </Button>
                <Button isDisabled={!isChanged} onPress={handleSave}>
                    {t('profile.save')}
                </Button>
            </div>
        </div>
    )
}
