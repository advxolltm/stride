import {
    Button,
    FieldError,
    Input,
    Label,
    Spinner,
    TextArea,
    TextField,
} from '@heroui/react'
import { Check, Pencil, X } from 'lucide-react'
import { useRef, useState } from 'react'

interface TaskTextFieldProps {
    label: string
    value: string
    onSave: (value: string) => void | Promise<void>
    validate?: (value: string) => string
    inputType?: 'text' | 'number'
    min?: number
    step?: number
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
    normalizeValue?: (value: string) => string
    multiline?: boolean
    isSaving?: boolean
    readOnly?: boolean
}

type EditState = {
    initialValue: string
    currentValue: string
}

export function TaskTextField({
    label,
    value,
    onSave,
    validate,
    inputType = 'text',
    min,
    step,
    inputMode,
    normalizeValue,
    multiline = false,
    isSaving = false,
    readOnly = false,
}: Readonly<TaskTextFieldProps>) {
    const [editState, setEditState] = useState<EditState | null>(null)
    const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

    const isEditing = editState !== null
    const currentValue = editState?.currentValue ?? value
    const error = isEditing ? validate?.(currentValue) || '' : ''

    function startEditing() {
        if (readOnly) return

        setEditState({ initialValue: value, currentValue: value })
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    function cancelEditing() {
        setEditState(null)
    }

    async function saveEditing() {
        if (!editState || error) return
        const nextValue = editState.currentValue
        setEditState(null)
        if (nextValue === editState.initialValue) return
        await onSave(nextValue)
    }

    function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
        if (!isEditing) return
        const nextFocusedElement = event.relatedTarget
        if (
            nextFocusedElement instanceof Node &&
            event.currentTarget.contains(nextFocusedElement)
        ) {
            return
        }
        cancelEditing()
    }

    return (
        <div onBlur={handleBlur}>
            <TextField
                className="w-full"
                value={currentValue}
                onChange={(nextValue) =>
                    setEditState((previousState) =>
                        previousState
                            ? {
                                  ...previousState,
                                  currentValue: normalizeValue
                                      ? normalizeValue(nextValue)
                                      : nextValue,
                              }
                            : previousState,
                    )
                }
                isInvalid={!!error}
            >
                <div className="flex w-full items-center justify-between gap-2">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-1">
                        {isSaving && <Spinner color="current" size="sm" />}
                        {!readOnly && isEditing ? (
                            <>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="ghost"
                                    aria-label={`Cancel ${label}`}
                                    isDisabled={isSaving}
                                    onPress={cancelEditing}
                                >
                                    <X size={14} />
                                </Button>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="ghost"
                                    aria-label={`Save ${label}`}
                                    isDisabled={!!error || isSaving}
                                    onPress={saveEditing}
                                >
                                    <Check size={14} />
                                </Button>
                            </>
                        ) : !readOnly ? (
                            <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                aria-label={`Edit ${label}`}
                                isDisabled={isSaving}
                                onPress={startEditing}
                            >
                                <Pencil size={14} />
                            </Button>
                        ) : null}
                    </div>
                </div>
                {multiline ? (
                    <TextArea
                        variant="secondary"
                        ref={inputRef}
                        readOnly={!isEditing || isSaving}
                        rows={4}
                    />
                ) : (
                    <Input
                        ref={inputRef}
                        type={inputType}
                        min={min}
                        step={step}
                        inputMode={inputMode}
                        variant="secondary"
                        readOnly={!isEditing || isSaving}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                void saveEditing()
                            }
                            if (event.key === 'Escape') {
                                event.preventDefault()
                                cancelEditing()
                            }
                        }}
                    />
                )}
                <FieldError>{error}</FieldError>
            </TextField>
        </div>
    )
}
