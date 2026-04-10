import { Button, FieldError, InputGroup, Label, TextField } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

type Props = {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export default function PasswordField({
    label,
    value,
    onChange,
    placeholder,
}: Props) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <TextField value={value} onChange={onChange}>
            <Label>{label}</Label>

            <InputGroup variant='secondary'>
                <InputGroup.Input
                    type={isVisible ? 'text' : 'password'}
                    placeholder={placeholder}
                />

                <InputGroup.Suffix>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={
                            isVisible ? 'Hide password' : 'Show password'
                        }
                        onPress={() => setIsVisible(!isVisible)}
                    >
                        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                </InputGroup.Suffix>
            </InputGroup>

            <FieldError />
        </TextField>
    )
}
