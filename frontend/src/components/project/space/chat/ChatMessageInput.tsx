import { Button, Form, InputGroup } from '@heroui/react'
import { SendHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ChatMessageInputProps {
    messageContent: string
    onMessageContentChange: (value: string) => void
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
    variant?: 'page' | 'embedded'
}

export function ChatMessageInput({
    messageContent,
    onMessageContentChange,
    onSubmit,
    variant = 'page',
}: ChatMessageInputProps) {
    const { t } = useTranslation('chat')
    const isEmbedded = variant === 'embedded'

    return (
        <div
            className={[
                'shrink-0 border-t-2 p-3 px-6',
                isEmbedded
                    ? 'border-border bg-surface-secondary'
                    : 'border-default-200 bg-background',
            ].join(' ')}
        >
            <Form className="w-full" onSubmit={onSubmit}>
                <div className="flex w-full items-center">
                    <InputGroup
                        fullWidth
                        className="border-default-200 bg-surface h-14 rounded-2xl border px-3 shadow-sm"
                    >
                        <InputGroup.Input
                            type="text"
                            placeholder={t('chat.input.placeholder')}
                            className="text-sm"
                            onChange={(event) =>
                                onMessageContentChange(event.target.value)
                            }
                            value={messageContent}
                        />
                        <InputGroup.Suffix>
                            <Button
                                isIconOnly
                                type="submit"
                                variant="primary"
                                className="rounded-xl"
                                isDisabled={!messageContent.trim()}
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
