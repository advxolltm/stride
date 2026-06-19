import { Button, Form, InputGroup } from '@heroui/react'
import { SendHorizontal } from 'lucide-react'
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

    return (
        <div
            className={[
                'shrink-0 border-t-2 p-1',
                isEmbedded
                    ? 'border-border bg-surface-secondary'
                    : 'border-default-200 bg-background',
                isDrawer ? 'px-4 pt-2' : 'px-6',
            ].join(' ')}
        >
            <Form className="w-full" onSubmit={onSubmit}>
                <div className="flex w-full items-center">
                    <InputGroup
                        isDisabled={readOnly}
                        fullWidth
                        className="border-default-200 bg-surface h-14 rounded-2xl border px-3 shadow-sm"
                    >
                        <InputGroup.Input
                            type="text"
                            placeholder={t(
                                readOnly
                                    ? 'chat.input.archivedPlaceholder'
                                    : 'chat.input.placeholder',
                            )}
                            className="text-sm"
                            onChange={(event) =>
                                readOnly
                                    ? undefined
                                    : onMessageContentChange(event.target.value)
                            }
                            value={messageContent}
                        />
                        <InputGroup.Suffix>
                            <Button
                                isIconOnly
                                type="submit"
                                variant="primary"
                                className="rounded-xl"
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
