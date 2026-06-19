import {
    Button,
    FieldError,
    Form,
    Input,
    Label,
    TextField,
    toast,
} from '@heroui/react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import AuthContainer from '../../components/auth/AuthContainer'
import PasswordInput from '../../components/auth/PasswordInput'
import { isOpenNetworkApplicationMode } from '../../config/applicationMode'
import { validationPolicy } from '../../config/validationPolicy'
import { getApiErrorMessage } from '../../shared/utils/api/errors'
import {
    passwordMinLength,
    validateStrongPassword,
} from '../../shared/utils/passwordValidation'
import { useCreateUserMutation } from '../../store/features/user/user.api'

export default function RegisterPage() {
    const { t } = useTranslation('common')
    const navigate = useNavigate()
    const [createUser, { isLoading }] = useCreateUserMutation()

    if (isOpenNetworkApplicationMode) {
        return <Navigate to="/login" replace />
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const formData = new FormData(e.currentTarget)
        const username = String(formData.get('username') ?? '').trim()
        const email = String(formData.get('email') ?? '').trim()
        const password = String(formData.get('password') ?? '')

        if (
            username.length < validationPolicy.usernameMinLength ||
            username.length > validationPolicy.usernameMaxLength
        ) {
            toast.danger(
                t('usernameValidation.length', {
                    min: validationPolicy.usernameMinLength,
                    max: validationPolicy.usernameMaxLength,
                }),
            )
            return
        }

        const passwordValidation = validateStrongPassword(password)
        if (!passwordValidation.isValid) {
            toast.danger(
                t(`passwordValidation.${passwordValidation.error}`, {
                    count: passwordMinLength,
                }),
            )
            return
        }

        try {
            await createUser({
                username,
                email,
                password,
            }).unwrap()

            navigate('/login')
        } catch (error: unknown) {
            toast.danger(
                getApiErrorMessage(error) || t('auth.register.errorGeneric'),
            )
        }
    }

    return (
        <AuthContainer
            heading={t('auth.register.heading')}
            subheading={t('auth.register.subheading')}
            footer={
                <>
                    {t('auth.register.haveAccount')}{' '}
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="font-semibold text-[var(--accent)] transition-opacity hover:opacity-75"
                    >
                        {t('auth.register.signIn')}
                    </button>
                </>
            }
        >
            <Form
                className="flex w-full flex-col gap-4"
                onSubmit={handleSubmit}
            >
                <TextField
                    className="w-full"
                    name="username"
                    isRequired
                    autoComplete="username"
                >
                    <Label className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                        {t('auth.register.usernameLabel')}
                    </Label>
                    <Input
                        minLength={validationPolicy.usernameMinLength}
                        maxLength={validationPolicy.usernameMaxLength}
                        placeholder={t('auth.register.usernamePlaceholder')}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-background)] px-3 py-2.5 pr-10 text-sm text-[var(--field-foreground)] transition-all outline-none placeholder:text-[var(--field-placeholder)] focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/15"
                    />
                    <FieldError />
                </TextField>

                <TextField
                    className="w-full"
                    name="email"
                    type="email"
                    isRequired
                    autoComplete="email"
                    validate={(value) => {
                        if (
                            !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(
                                value,
                            )
                        ) {
                            return t('auth.register.emailInvalid')
                        }
                        return null
                    }}
                >
                    <Label className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                        {t('auth.register.emailLabel')}
                    </Label>
                    <Input
                        placeholder={t('auth.register.emailPlaceholder')}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-background)] px-3 py-2.5 pr-10 text-sm text-[var(--field-foreground)] transition-all outline-none placeholder:text-[var(--field-placeholder)] focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/15"
                    />
                    <FieldError />
                </TextField>

                <PasswordInput
                    placeholder={t('passwordInput.createPlaceholder')}
                    autoComplete="new-password"
                />

                <Button
                    type="submit"
                    fullWidth
                    isPending={isLoading}
                    className="mt-1 h-11 rounded-xl bg-[var(--accent)] text-base text-white transition-opacity hover:opacity-90"
                >
                    {t('auth.register.submit')}
                </Button>
            </Form>
        </AuthContainer>
    )
}
