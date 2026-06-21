import { Button, Form, InputGroup } from '@heroui/react'
import { SendHorizontal } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface ChatMessageInputProps {
    messageContent: string
    onMessageContentChange: (value: string) => void
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
    readOnly?: boolean
    variant?: 'page' | 'embedded' | 'drawer'
}

export function ChatMessageInput({
    messageContent,
    onMessageContentChange,
    onSubmit,
    readOnly = false,
    variant = 'page',
}: ChatMessageInputProps) {
    const { t } = useTranslation('chat')
    const isEmbedded = variant === 'embedded'
    const isDrawer = variant === 'drawer'
    const inputRef = useRef<HTMLTextAreaElement | null>(null)

    const resizeInput = useCallback(() => {
        const input = inputRef.current
        if (!input) {
            return
        }

        const computedStyle = window.getComputedStyle(input)
        const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20
        const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
        const paddingBottom =
            Number.parseFloat(computedStyle.paddingBottom) || 0
        const maxHeight = lineHeight * 8 + paddingTop + paddingBottom

        input.style.height = 'auto'
        input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`
        input.style.overflowY =
            input.scrollHeight > maxHeight ? 'auto' : 'hidden'
    }, [])

    useLayoutEffect(() => {
        resizeInput()
    }, [messageContent, resizeInput])

    const handleInputKeyDown = (
        event: React.KeyboardEvent<HTMLTextAreaElement>,
    ) => {
        if (event.key !== 'Enter' || event.shiftKey) {
            return
        }

        if (
            typeof window !== 'undefined' &&
            window.matchMedia('(pointer: coarse)').matches
        ) {
            return
        }

        event.preventDefault()

        if (event.currentTarget.value.trim()) {
            event.currentTarget.form?.requestSubmit()
        }
    }

    return (
        <div
            className={[
                'shrink-0 touch-manipulation pb-1',
                isEmbedded
                    ? 'border-border bg-surface-secondary'
                    : 'border-default-200 bg-background',
                isDrawer ? 'px-4 pt-2' : 'px-4',
            ].join(' ')}
        >
            <Form className="w-full" onSubmit={onSubmit}>
                <div className="flex w-full items-center">
                    <InputGroup
                        isDisabled={readOnly}
                        fullWidth
                        className="border-default-200 bg-surface flex min-h-14 flex-row items-end gap-2 rounded-2xl border px-3 py-2 shadow-sm"
                    >
                        <InputGroup.TextArea
                            ref={inputRef}
                            placeholder={t(
                                readOnly
                                    ? 'chat.input.archivedPlaceholder'
                                    : 'chat.input.placeholder',
                            )}
                            rows={1}
                            disabled={readOnly}
                            enterKeyHint="enter"
                            className="app-scrollbar app-scrollbar-compact min-h-9 resize-none text-base leading-5"
                            style={{ fontSize: 16 }}
                            onKeyDown={handleInputKeyDown}
                            onChange={(event) => {
                                if (readOnly) {
                                    return
                                }

                                onMessageContentChange(event.target.value)
                            }}
                            value={messageContent}
                        />
                        <InputGroup.Suffix className="p-0">
                            <Button
                                isIconOnly
                                type="submit"
                                variant="primary"
                                className="touch-manipulation rounded-xl"
                                isDisabled={readOnly || !messageContent.trim()}
                            >
                                <SendHorizontal size={18} />
                            </Button>
                        </InputGroup.Suffix>
                    </InputGroup>
                </div>
            </Form>
        </div>
    )
}
