import { Input, Label, Spinner, TextArea, TextField } from '@heroui/react'
import { useEffect, useState } from 'react'

interface TaskTextFieldProps {
    label: string
    defaultValue: string
    onBlur: (value: string) => void | Promise<void>
    multiline?: boolean
    isSaving?: boolean
}

export function TaskTextField({
    label,
    defaultValue,
    onBlur,
    multiline = false,
    isSaving = false,
}: TaskTextFieldProps) {
    const [value, setValue] = useState(defaultValue)

    useEffect(() => {
        setValue(defaultValue)
    }, [defaultValue])

    return (
        <TextField className="w-full" value={value} onChange={setValue}>
            <div className="flex w-full items-center justify-between gap-2">
                <Label>{label}</Label>
                {isSaving && <Spinner color="current" size="sm" />}
            </div>
            {multiline ? (
                <TextArea
                    variant="secondary"
                    rows={4}
                    disabled={isSaving}
                    onBlur={() => onBlur(value)}
                />
            ) : (
                <Input
                    variant="secondary"
                    disabled={isSaving}
                    onBlur={() => onBlur(value)}
                />
            )}
        </TextField>
    )
}
