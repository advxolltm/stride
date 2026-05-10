import {
    Button,
    FieldError,
    Form,
    Input,
    Label,
    TextField,
    toast,
} from '@heroui/react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import AuthContainer from '../../components/auth/AuthContainer'
import PasswordInput from '../../components/auth/PasswordInput'
import { getApiErrorMessage } from '../../shared/utils/api/errors'
import { useCreateUserMutation } from '../../store/features/user/user.api'

export default function RegisterPage() {
    const { t } = useTranslation('common')
    const navigate = useNavigate()
    const [createUser, { isLoading }] = useCreateUserMutation()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const formData = new FormData(e.currentTarget)
        const username = String(formData.get('username') ?? '').trim()
        const email = String(formData.get('email') ?? '').trim()
        const password = String(formData.get('password') ?? '')

        try {
            await createUser({
                username,
                email,
                password,
            }).unwrap()

            navigate('/login')
        } catch (error: unknown) {
            toast.danger(
                getApiErrorMessage(error) || 'Failed to create account',
            )
        }
    }

    return (
        <AuthContainer
            heading="Create an account"
            subheading="Get started with STRIDE today"
            footer={
                <>
                    Already have an account?{' '}
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="font-semibold text-[var(--accent)] transition-opacity hover:opacity-75"
                    >
                        Sign in
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
                        Username
                    </Label>
                    <Input
                        placeholder="Choose a username"
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
                            return 'Please enter a valid email address'
                        }
                        return null
                    }}
                >
                    <Label className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                        Email
                    </Label>
                    <Input
                        placeholder="Enter your email"
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
                    Create account
                </Button>
            </Form>
        </AuthContainer>
    )
}
