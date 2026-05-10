import { skipToken } from '@reduxjs/toolkit/query'
import { Button, Spinner, toast } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
    useGetUserByIdQuery,
    useUpdateUserMutation,
} from '../../../store/features/user/user.api'
import type { ApiErrorResponse } from '../../../store/features/user/user.types'
import type { User } from '../../../shared/types'
import { ProfileAvatarUpload } from './ProfileAvatarUpload'
import { ProfileDetailsForm } from './ProfileDetailsForm'
import { isFetchBaseQueryError } from '../../../shared/utils/api/errors'
import { useAppSelector } from '../../../shared/hooks/redux'
import { selectUserId } from '../../../store/userSlice'

export type ProfileForm = {
    fullName: string
    username: string
    email: string
    avatarFile: File | null
    avatarRemoved: boolean
}

const createProfileForm = (user: User): ProfileForm => ({
    fullName: user.fullName ?? '',
    username: user.username,
    email: user.email,
    avatarFile: null,
    avatarRemoved: false,
})

export function ProfileSection() {
    const userId = useAppSelector(selectUserId)
    const { data: user } = useGetUserByIdQuery(userId ?? skipToken)

    if (!user) {
        return (
            <div className="flex min-h-40 items-center justify-center">
                <Spinner size="md" />
            </div>
        )
    }

    return <LoadedProfileSection user={user} />
}

function LoadedProfileSection({ user }: Readonly<{ user: User }>) {
    const { t } = useTranslation('setting')
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation()
    const [form, setForm] = useState<ProfileForm>(() => createProfileForm(user))

    const isChanged =
        form.fullName.trim() !== (user.fullName ?? '') ||
        form.email.trim() !== user.email ||
        form.avatarFile !== null ||
        form.avatarRemoved

    const handleReset = () => {
        setForm(createProfileForm(user))
    }

    const handleSave = async () => {
        if (!isChanged || isUpdating) return

        const nextFullName = form.fullName.trim()
        const nextEmail = form.email.trim()

        const body = new FormData()
        if (nextFullName !== (user.fullName ?? '')) {
            body.set('full_name', nextFullName)
        }
        if (nextEmail !== user.email) {
            body.set('email', nextEmail)
        }
        if (form.avatarRemoved) {
            body.set('remove_avatar', 'true')
        } else if (form.avatarFile) {
            body.set('avatar', form.avatarFile)
        }

        try {
            const updatedUser = await updateUser({ id: user.id, body }).unwrap()
            setForm(createProfileForm(updatedUser))
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
                avatarRemoved={form.avatarRemoved}
                onAvatarChange={(file) =>
                    setForm((prev) => ({
                        ...prev,
                        avatarFile: file,
                        avatarRemoved: false,
                    }))
                }
                onAvatarRemove={() =>
                    setForm((prev) => ({
                        ...prev,
                        avatarFile: null,
                        avatarRemoved: true,
                    }))
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
