import { useState } from 'react'
import { Input, Label, TextField } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

interface PasswordInputProps {
    label?: string
    placeholder?: string
    name?: string
    autoComplete?: string
    isRequired?: boolean
}

export default function PasswordInput({
    label = 'Password',
    placeholder = 'Enter your password',
    name = 'password',
    autoComplete = 'current-password',
    isRequired = true,
}: PasswordInputProps) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <TextField
            className="w-full"
            name={name}
            autoComplete={autoComplete}
            isRequired={isRequired}
        >
            <Label className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                {label}
            </Label>
            <div className="relative">
                <Input
                    type={isVisible ? 'text' : 'password'}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-background)] px-3 py-2.5 pr-10 text-sm text-[var(--field-foreground)] transition-all outline-none placeholder:text-[var(--field-placeholder)] focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/15"
                />
                <button
                    type="button"
                    onClick={() => setIsVisible((v) => !v)}
                    aria-label={isVisible ? 'Hide password' : 'Show password'}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                    {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
        </TextField>
    )
}
