import { useState } from 'react'
import { Input, Label, TextField } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PasswordInputProps {
    label?: string
    placeholder?: string
    name?: string
    autoComplete?: string
    isRequired?: boolean
    value?: string
    onChange?: (value: string) => void
    variant?: 'primary' | 'secondary'
}

export default function PasswordInput({
    label,
    placeholder,
    name = 'password',
    autoComplete = 'current-password',
    isRequired = true,
    variant = 'primary',
    value,
    onChange,
}: PasswordInputProps) {
    const { t } = useTranslation('common')
    const [isVisible, setIsVisible] = useState(false)
    const labelText = label ?? t('passwordInput.label')
    const placeholderText = placeholder ?? t('passwordInput.placeholder')

    return (
        <TextField
            className="w-full"
            name={name}
            autoComplete={autoComplete}
            isRequired={isRequired}
            value={value}
            onChange={onChange}
            type="password"
        >
            <Label className="mb-1 text-sm font-semibold text-(--foreground)">
                {labelText}
            </Label>
            <div className="relative">
                <Input
                    type={isVisible ? 'text' : 'password'}
                    placeholder={placeholderText}
                    className="border-border focus:border-focus w-full rounded-xl border px-3 py-2.5 pr-10 text-sm text-(--field-foreground) transition-all outline-none placeholder:text-(--field-placeholder) focus:ring-2 focus:ring-(--focus)/15"
                    variant={variant}
                />
                <button
                    type="button"
                    onClick={() => setIsVisible((v) => !v)}
                    aria-label={
                        isVisible
                            ? t('passwordInput.hide')
                            : t('passwordInput.show')
                    }
                    className="text-muted absolute top-1/2 right-3 -translate-y-1/2 transition-colors hover:text-(--foreground)"
                >
                    {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
        </TextField>
    )
}
