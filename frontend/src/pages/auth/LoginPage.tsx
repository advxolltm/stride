import { useState } from 'react'
import {
    Button,
    FieldError,
    Form,
    Input,
    Label,
    TextField,
} from '@heroui/react'
import { useNavigate } from 'react-router'
import AuthContainer from '../../components/auth/AuthContainer'
import PasswordInput from '../../components/auth/PasswordInput'

export default function LoginPage() {
    const navigate = useNavigate()
    const [isPending, setIsPending] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsPending(true)
        await new Promise((res) => setTimeout(res, 1200))
        setIsPending(false)
    }

    return (
        <AuthContainer
            heading="Welcome back"
            subheading="Sign in to your account to continue"
            footer={
                <>
                    Don't have an account?{' '}
                    <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className="font-semibold text-[var(--accent)] transition-opacity hover:opacity-75"
                    >
                        Create account
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
                        placeholder="Enter your username"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-background)] px-3 py-2.5 pr-10 text-sm text-[var(--field-foreground)] transition-all outline-none placeholder:text-[var(--field-placeholder)] focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/15"
                    />
                    <FieldError />
                </TextField>

                <div className="flex w-full flex-col gap-1.5">
                    <PasswordInput
                        placeholder="Enter your password"
                        autoComplete="current-password"
                    />
                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="text-xs font-semibold text-[var(--accent)] transition-opacity hover:underline"
                        >
                            Forgot password?
                        </button>
                    </div>
                </div>

                <Button
                    type="submit"
                    fullWidth
                    isPending={isPending}
                    className="mt-1 h-11 rounded-md bg-[var(--accent)] text-base  text-white transition-opacity hover:opacity-90"
                >
                    Sign in
                </Button>
            </Form>
        </AuthContainer>
    )
}
