import { Button, Spinner, toast } from '@heroui/react'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
    useGetUserByIdQuery,
    useUpdateUserMutation,
} from '../../../store/features/user/user.api'
import type {
    ApiErrorResponse,
    UpdateUserRequest,
} from '../../../store/features/user/user.types'
import { ProfileAvatarUpload } from './ProfileAvatarUpload'
import { ProfileDetailsForm } from './ProfileDetailsForm'

export type ProfileForm = {
    fullName: string
    username: string
    email: string
    avatarFile: File | null
}

const isFetchBaseQueryError = (error: unknown): error is FetchBaseQueryError =>
    typeof error === 'object' && error !== null && 'status' in error

//TODO:This should come from redux slice of authSlice
const USER_ID = '9b4a0d98-db51-4372-8d83-db13ccf048a8'

export function ProfileSection() {
    const { t } = useTranslation('setting')

    const { data: user } = useGetUserByIdQuery(USER_ID)
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

        const body: UpdateUserRequest = {}
        if (form.fullName.trim() !== (user?.fullName ?? ''))
            body.full_name = form.fullName.trim()
        if (form.email.trim() !== (user?.email ?? ''))
            body.email = form.email.trim()

        try {
            await updateUser({ id: USER_ID, body }).unwrap()
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
