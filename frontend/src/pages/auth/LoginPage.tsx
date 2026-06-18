import {
    Button,
    FieldError,
    Form,
    Input,
    Label,
    TextField,
    toast,
} from '@heroui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AuthContainer from '../../components/auth/AuthContainer'
import PasswordInput from '../../components/auth/PasswordInput'
import { isOpenNetworkApplicationMode } from '../../config/applicationMode'
import { useLoginMutation } from '../../store/features/auth/auth.api'

export default function LoginPage() {
    const { t } = useTranslation('common')
    const navigate = useNavigate()
    const location = useLocation()
    const [login, { isLoading }] = useLoginMutation()
    const redirectTarget =
        typeof location.state === 'object' &&
        location.state !== null &&
        'from' in location.state &&
        typeof location.state.from === 'object' &&
        location.state.from !== null &&
        'pathname' in location.state.from &&
        typeof location.state.from.pathname === 'string'
            ? location.state.from.pathname
            : '/'

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const formData = new FormData(e.currentTarget)
        const email = String(formData.get('email') ?? '').trim()
        const password = String(formData.get('password') ?? '')

        try {
            await login({
                email,
                password,
            }).unwrap()

            navigate(redirectTarget, { replace: true })
        } catch (error: unknown) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'status' in error &&
                error.status === 401
            ) {
                toast.danger(t('auth.login.errorInvalidCredentials'))
            } else {
                console.error('Login error:', error)
                toast.danger(t('auth.login.errorGeneric'))
            }
        }
    }

    return (
        <AuthContainer
            heading={t('auth.login.heading')}
            subheading={t('auth.login.subheading')}
            footer={
                isOpenNetworkApplicationMode ? null : (
                    <>
                        {t('auth.login.noAccount')}{' '}
                        <button
                            type="button"
                            onClick={() => navigate('/register')}
                            className="font-semibold text-[var(--accent)] transition-opacity hover:opacity-75"
                        >
                            {t('auth.login.createAccount')}
                        </button>
                    </>
                )
            }
        >
            <Form
                className="flex w-full flex-col gap-4"
                onSubmit={handleSubmit}
            >
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
                            return t('auth.login.emailInvalid')
                        }
                        return null
                    }}
                >
                    <Label className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                        {t('auth.login.emailLabel')}
                    </Label>
                    <Input
                        placeholder={t('auth.login.emailPlaceholder')}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-background)] px-3 py-2.5 pr-10 text-sm text-[var(--field-foreground)] transition-all outline-none placeholder:text-[var(--field-placeholder)] focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/15"
                    />
                    <FieldError />
                </TextField>

                <div className="flex w-full flex-col gap-1.5">
                    <PasswordInput
                        placeholder={t('passwordInput.placeholder')}
                        autoComplete="current-password"
                    />
                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="text-xs font-semibold text-[var(--accent)] transition-opacity hover:underline"
                        >
                            {t('auth.login.forgotPassword')}
                        </button>
                    </div>
                </div>

                <Button
                    type="submit"
                    fullWidth
                    isPending={isLoading}
                    className="mt-1 h-11 rounded-md bg-[var(--accent)] text-base text-white transition-opacity hover:opacity-90"
                >
                    {t('auth.login.submit')}
                </Button>
            </Form>
        </AuthContainer>
    )
}
