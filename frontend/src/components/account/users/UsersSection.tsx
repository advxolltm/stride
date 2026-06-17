import {
    Button,
    FieldError,
    Form,
    Input,
    Label,
    Modal,
    Spinner,
    TextField,
    toast,
} from '@heroui/react'
import { KeyRound, Trash2, UserPlus } from 'lucide-react'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import PasswordInput from '../../auth/PasswordInput'
import { ConfirmDialog } from '../../../shared/components'
import { validationPolicy } from '../../../config/validationPolicy'
import type { User } from '../../../shared/types'
import { getApiErrorMessage } from '../../../shared/utils/api/errors'
import {
    passwordMinLength,
    validateStrongPassword,
} from '../../../shared/utils/passwordValidation'
import {
    useCreateUserMutation,
    useDeleteUserMutation,
    useGetUsersQuery,
    useResetUserPasswordMutation,
} from '../../../store/features/user/user.api'
import { selectUserId } from '../../../store/userSlice'
import { useAppSelector } from '../../../shared/hooks/redux'

const emptyCreateForm = {
    username: '',
    email: '',
    password: '',
}

const emptyResetForm = {
    password: '',
    confirmPassword: '',
}

export function UsersSection() {
    const { t } = useTranslation('setting')
    const currentUserId = useAppSelector(selectUserId)
    const { data: users = [], isLoading } = useGetUsersQuery()
    const [createUser, { isLoading: isCreating }] = useCreateUserMutation()
    const [resetPassword, { isLoading: isResetting }] =
        useResetUserPasswordMutation()
    const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation()

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [createForm, setCreateForm] = useState(emptyCreateForm)
    const [resetTarget, setResetTarget] = useState<User | null>(null)
    const [resetForm, setResetForm] = useState(emptyResetForm)
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

    const sortedUsers = useMemo(
        () =>
            [...users].sort((a, b) =>
                (a.fullName ?? a.username).localeCompare(
                    b.fullName ?? b.username,
                ),
            ),
        [users],
    )

    const validatePassword = (password: string) => {
        const result = validateStrongPassword(password)
        if (!result.isValid) {
            toast.danger(
                t(`users.${result.error}`, { count: passwordMinLength }),
            )
            return false
        }
        return true
    }

    const validateUsername = (username: string) => {
        if (
            username.length < validationPolicy.usernameMinLength ||
            username.length > validationPolicy.usernameMaxLength
        ) {
            toast.danger(
                t('users.usernameLength', {
                    min: validationPolicy.usernameMinLength,
                    max: validationPolicy.usernameMaxLength,
                }),
            )
            return false
        }
        return true
    }

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const username = createForm.username.trim()
        const email = createForm.email.trim()
        const password = createForm.password

        if (!validateUsername(username)) return
        if (!validatePassword(password)) return

        try {
            await createUser({ username, email, password }).unwrap()
            toast.success(t('users.createSuccess'))
            setCreateForm(emptyCreateForm)
            setIsCreateOpen(false)
        } catch (error: unknown) {
            toast.danger(getApiErrorMessage(error, t('users.createError')))
        }
    }

    const handleReset = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!resetTarget) return

        if (resetForm.password !== resetForm.confirmPassword) {
            toast.danger(t('users.passwordMismatch'))
            return
        }
        if (!validatePassword(resetForm.password)) return

        try {
            await resetPassword({
                id: resetTarget.id,
                body: { new_password: resetForm.password },
            }).unwrap()
            toast.success(t('users.resetSuccess'))
            setResetTarget(null)
            setResetForm(emptyResetForm)
        } catch (error: unknown) {
            toast.danger(getApiErrorMessage(error, t('users.resetError')))
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget || deleteTarget.id === currentUserId) return

        try {
            await deleteUser(deleteTarget.id).unwrap()
            toast.success(t('users.deleteSuccess'))
            setDeleteTarget(null)
        } catch (error: unknown) {
            toast.danger(getApiErrorMessage(error, t('users.deleteError')))
        }
    }

    const openResetDialog = (user: User) => {
        setResetTarget(user)
        setResetForm(emptyResetForm)
    }

    const displayName = (user: User) => user.fullName ?? user.username

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-semibold">{t('users.title')}</h2>
                    <p className="text-muted-foreground text-sm">
                        {t('users.description')}
                    </p>
                </div>
                <Button onPress={() => setIsCreateOpen(true)}>
                    <UserPlus size={16} />
                    {t('users.addUser')}
                </Button>
            </div>

            <div className="border-border bg-surface overflow-hidden rounded-xl border">
                {isLoading ? (
                    <div className="flex min-h-40 items-center justify-center">
                        <Spinner size="md" />
                    </div>
                ) : (
                    <div className="divide-border divide-y">
                        {sortedUsers.map((user) => {
                            const isSelf = user.id === currentUserId
                            return (
                                <div
                                    key={user.id}
                                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="truncate font-medium">
                                                {displayName(user)}
                                            </p>
                                            {user.isSuperuser ? (
                                                <span className="border-border bg-background text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium">
                                                    {t('users.superuserBadge')}
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="text-muted-foreground truncate text-sm">
                                            {user.email}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onPress={() =>
                                                openResetDialog(user)
                                            }
                                        >
                                            <KeyRound size={15} />
                                            {t('users.resetPassword')}
                                        </Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            isDisabled={isSelf}
                                            onPress={() =>
                                                setDeleteTarget(user)
                                            }
                                        >
                                            <Trash2 size={15} />
                                            {t('users.delete')}
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <Modal.Backdrop
                isOpen={isCreateOpen}
                onOpenChange={(open) => {
                    setIsCreateOpen(open)
                    if (!open) setCreateForm(emptyCreateForm)
                }}
            >
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{t('users.addUser')}</Modal.Heading>
                        </Modal.Header>
                        <Form className="flex flex-col" onSubmit={handleCreate}>
                            <Modal.Body className="flex w-full flex-col gap-4 px-6">
                                <TextField
                                    className="w-full"
                                    name="username"
                                    isRequired
                                    value={createForm.username}
                                    onChange={(username) =>
                                        setCreateForm((prev) => ({
                                            ...prev,
                                            username,
                                        }))
                                    }
                                >
                                    <Label>{t('users.username')}</Label>
                                    <Input
                                        minLength={
                                            validationPolicy.usernameMinLength
                                        }
                                        maxLength={
                                            validationPolicy.usernameMaxLength
                                        }
                                        className="p-3"
                                        variant="secondary"
                                        autoComplete="username"
                                    />
                                    <FieldError />
                                </TextField>
                                <TextField
                                    className="w-full"
                                    name="email"
                                    type="email"
                                    isRequired
                                    value={createForm.email}
                                    onChange={(email) =>
                                        setCreateForm((prev) => ({
                                            ...prev,
                                            email,
                                        }))
                                    }
                                >
                                    <Label>{t('users.email')}</Label>
                                    <Input
                                        className="p-3"
                                        variant="secondary"
                                        autoComplete="email"
                                    />
                                    <FieldError />
                                </TextField>
                                <PasswordInput
                                    label={t('users.password')}
                                    value={createForm.password}
                                    onChange={(password) =>
                                        setCreateForm((prev) => ({
                                            ...prev,
                                            password,
                                        }))
                                    }
                                    autoComplete="new-password"
                                    variant="secondary"
                                />
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    variant="ghost"
                                    isDisabled={isCreating}
                                    onPress={() => setIsCreateOpen(false)}
                                >
                                    {t('users.cancel')}
                                </Button>
                                <Button type="submit" isPending={isCreating}>
                                    {t('users.create')}
                                </Button>
                            </Modal.Footer>
                        </Form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>

            <Modal.Backdrop
                isOpen={resetTarget !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setResetTarget(null)
                        setResetForm(emptyResetForm)
                    }
                }}
            >
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>
                                {t('users.resetPasswordTitle')}
                            </Modal.Heading>
                            {resetTarget ? (
                                <p className="text-muted-foreground mt-1 text-sm">
                                    {displayName(resetTarget)}
                                </p>
                            ) : null}
                        </Modal.Header>
                        <Form className="flex flex-col" onSubmit={handleReset}>
                            <Modal.Body className="flex w-full flex-col gap-4">
                                <PasswordInput
                                    label={t('users.newPassword')}
                                    value={resetForm.password}
                                    onChange={(password) =>
                                        setResetForm((prev) => ({
                                            ...prev,
                                            password,
                                        }))
                                    }
                                    autoComplete="new-password"
                                    variant="secondary"
                                />
                                <PasswordInput
                                    label={t('users.confirmPassword')}
                                    name="confirmPassword"
                                    value={resetForm.confirmPassword}
                                    onChange={(confirmPassword) =>
                                        setResetForm((prev) => ({
                                            ...prev,
                                            confirmPassword,
                                        }))
                                    }
                                    autoComplete="off"
                                    variant="secondary"
                                />
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    variant="ghost"
                                    isDisabled={isResetting}
                                    onPress={() => setResetTarget(null)}
                                >
                                    {t('users.cancel')}
                                </Button>
                                <Button type="submit" isPending={isResetting}>
                                    {t('users.resetPassword')}
                                </Button>
                            </Modal.Footer>
                        </Form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>

            <ConfirmDialog
                isOpen={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
                title={t('users.deleteTitle')}
                message={
                    deleteTarget
                        ? t('users.deleteMessage', {
                              user: displayName(deleteTarget),
                          })
                        : ''
                }
                confirmLabel={t('users.delete')}
                pendingConfirmLabel={t('users.deleting')}
                confirmVariant="danger"
                isConfirmPending={isDeleting}
                closeOnConfirm={false}
                onConfirm={handleDelete}
            />
        </div>
    )
}
