import {
    Button,
    Dropdown,
    Form,
    TextArea,
    Tooltip,
    toast,
    type Key,
} from '@heroui/react'
import { Check, Copy, EllipsisVertical, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog, UserAvatar } from '../../../../shared/components'
import type { Message } from '../../../../store/features/chat/chat.types'
import type { ProjectMember } from '../../../../store/features/project/project.types'

interface ChatMessageItemProps {
    message: Message
    sender?: ProjectMember
    isOwnMessage: boolean
    timeLabel: string
    editedLabel?: string | null
    onEditMessage: (message: Message, content: string) => Promise<void>
    onMessageAction: (key: Key, message: Message) => Promise<void>
}

const MESSAGE_ROW_MAX_WIDTH = 'max-w-[min(42rem,100%)]'
const MESSAGE_BUBBLE_MAX_WIDTH = 'max-w-[calc(100%-2rem)]'

function SenderAvatar({ sender }: Readonly<{ sender?: ProjectMember }>) {
    const senderName = sender?.user.fullName || sender?.user.username || 'NA'

    return (
        <UserAvatar
            name={senderName}
            src={
                sender?.user.avatarSmallUrl ??
                sender?.user.avatarUrl ??
                undefined
            }
        />
    )
}

function EditedIndicator({
    editedLabel,
}: Readonly<{ editedLabel?: string | null }>) {
    const { t } = useTranslation('chat')

    if (!editedLabel) {
        return null
    }

    return (
        <Tooltip delay={0}>
            <Tooltip.Trigger className="inline-flex">
                <span className="text-default-500 cursor-help underline decoration-dotted underline-offset-2">
                    {t('chat.message.lastEdited')}
                </span>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow placement="top">
                <Tooltip.Arrow />
                {editedLabel}
            </Tooltip.Content>
        </Tooltip>
    )
}

function MessageMenu({
    onAction,
    ownMessage = false,
    buttonClassName,
    onOpenChange,
}: Readonly<{
    onAction: (key: Key) => Promise<void>
    ownMessage?: boolean
    buttonClassName?: string
    onOpenChange?: (isOpen: boolean) => void
}>) {
    const { t } = useTranslation('chat')

    return (
        <Dropdown onOpenChange={onOpenChange}>
            <Button
                isIconOnly
                variant="ghost"
                aria-label={t('chat.message.menu')}
                className={[
                    'h-5 w-5 min-w-5 rounded-full p-0 shadow-none',
                    buttonClassName ?? 'text-foreground',
                ].join(' ')}
            >
                <EllipsisVertical size={12} />
            </Button>
            <Dropdown.Popover>
                <Dropdown.Menu onAction={onAction}>
                    {ownMessage ? (
                        <Dropdown.Item id="edit-message">
                            <Pencil size={16} /> {t('chat.message.edit')}
                        </Dropdown.Item>
                    ) : null}
                    <Dropdown.Item id="copy-message">
                        <Copy size={16} /> {t('chat.message.copy')}
                    </Dropdown.Item>
                    {ownMessage ? (
                        <Dropdown.Item
                            className="text-danger"
                            id="delete-message"
                            variant="danger"
                        >
                            <Trash2 size={16} /> {t('chat.message.delete')}
                        </Dropdown.Item>
                    ) : null}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    )
}

export function ChatMessageItem({
    message,
    sender,
    isOwnMessage,
    timeLabel,
    editedLabel,
    onEditMessage,
    onMessageAction,
}: Readonly<ChatMessageItemProps>) {
    const { t } = useTranslation('chat')
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(message.content)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isDeletePending, setIsDeletePending] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const editInputRef = useRef<HTMLTextAreaElement | null>(null)
    const senderName =
        sender?.user.fullName ||
        sender?.user.username ||
        t('chat.message.userDeleted')
    const trimmedEditValue = editValue.trim()

    useEffect(() => {
        if (!isEditing) {
            return
        }

        const input = editInputRef.current
        if (!input) {
            return
        }

        input.focus()
        const contentLength = input.value.length
        input.setSelectionRange(contentLength, contentLength)
    }, [isEditing])

    function handleCancelEdit() {
        setEditValue(message.content)
        setIsEditing(false)
    }

    async function saveInlineEdit() {
        if (!trimmedEditValue || trimmedEditValue === message.content.trim()) {
            handleCancelEdit()
            return
        }

        setIsSaving(true)

        try {
            await onEditMessage(message, trimmedEditValue)
            setIsEditing(false)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleInlineEditSubmit(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault()
        await saveInlineEdit()
    }

    async function handleCopyMessage() {
        try {
            await navigator.clipboard.writeText(message.content)
            toast.success(t('chat.copy.success'))
        } catch {
            toast.danger(t('chat.copy.error'))
        }
    }

    async function handleOwnMessageAction(key: Key) {
        if (key === 'edit-message') {
            setEditValue(message.content)
            setIsEditing(true)
            return
        }

        if (key === 'copy-message') {
            await handleCopyMessage()
            return
        }

        if (key === 'delete-message') {
            setIsDeleteConfirmOpen(true)
            return
        }

        await onMessageAction(key, message)
    }

    async function handleOtherMessageAction(key: Key) {
        if (key === 'copy-message') {
            await handleCopyMessage()
            return
        }

        await onMessageAction(key, message)
    }

    async function handleConfirmDelete() {
        setIsDeletePending(true)

        try {
            await onMessageAction('delete-message', message)
            setIsDeleteConfirmOpen(false)
        } finally {
            setIsDeletePending(false)
        }
    }

    if (!sender) {
        return (
            <div key={message.id} id={message.id} className="mb-6 flex gap-3">
                <SenderAvatar />
                <div className="max-w-full min-w-0">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                        <span className="text-foreground font-semibold">
                            {t('chat.message.userDeleted')}
                        </span>
                        <span className="text-default-400">&bull;</span>
                        <span className="text-default-500">{timeLabel}</span>
                        {editedLabel ? (
                            <>
                                <span className="text-default-400">&bull;</span>
                                <span className="text-default-500">
                                    {t('chat.message.lastEdited')}
                                </span>
                            </>
                        ) : null}
                    </div>
                    <div className="bg-default-100 text-foreground w-fit max-w-full rounded-2xl rounded-tl-md px-4 py-3 text-sm">
                        <p className="break-all whitespace-pre-wrap">
                            {message.content}
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (!isOwnMessage) {
        return (
            <div key={message.id} id={message.id} className="mb-6 flex gap-3">
                <SenderAvatar sender={sender} />
                <div className={`group min-w-0 ${MESSAGE_ROW_MAX_WIDTH}`}>
                    <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2 text-xs">
                        <span className="text-foreground font-semibold">
                            {senderName}
                        </span>
                        <span className="text-default-400">&bull;</span>
                        <span className="text-default-500">{timeLabel}</span>
                        {editedLabel ? (
                            <>
                                <span className="text-default-400">&bull;</span>
                                <EditedIndicator editedLabel={editedLabel} />
                            </>
                        ) : null}
                    </div>
                    <div className="flex max-w-full items-start gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                        </div>
                        <div
                            className={`bg-default text-foreground min-w-0 rounded-2xl rounded-tl-md px-4 py-3 text-sm ${MESSAGE_BUBBLE_MAX_WIDTH}`}
                        >
                            <p className="break-all whitespace-pre-wrap">
                                {message.content}
                            </p>
                        </div>
                        <div className="flex h-full w-8 shrink-0 items-start justify-center pt-2">
                            <div
                                className={[
                                    'pointer-events-none transition-opacity',
                                    isMenuOpen
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover:opacity-100',
                                ].join(' ')}
                            >
                                <MessageMenu
                                    onAction={handleOtherMessageAction}
                                    buttonClassName="pointer-events-auto text-default-500 hover:text-default-700 bg-default-50/90 hover:bg-default-100 border border-default-200/80"
                                    onOpenChange={setIsMenuOpen}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div
                key={message.id}
                id={message.id}
                className="mb-6 flex justify-end"
            >
                <div
                    className={[
                        'group ml-auto min-w-0',
                        MESSAGE_ROW_MAX_WIDTH,
                        isEditing ? 'w-full' : '',
                    ].join(' ')}
                >
                    <div className="mb-1 flex min-w-0 flex-wrap items-center justify-end gap-2 text-xs">
                        {editedLabel ? (
                            <EditedIndicator editedLabel={editedLabel} />
                        ) : null}
                        <span className="text-default-500">{timeLabel}</span>
                        <span className="text-default-400">&bull;</span>
                        <span className="text-foreground font-semibold">
                            {t('chat.message.you')}
                        </span>
                    </div>

                    {isEditing ? (
                        <Form
                            onSubmit={handleInlineEditSubmit}
                            className="ml-auto w-full min-w-0 self-stretch"
                        >
                            <div className="bg-surface border-default-200 flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-2xl rounded-br-md border px-3 py-3 shadow-sm">
                                <TextArea
                                    ref={editInputRef}
                                    variant="secondary"
                                    rows={Math.min(
                                        6,
                                        Math.max(4, editValue.split('\n').length),
                                    )}
                                    value={editValue}
                                    onChange={(event) =>
                                        setEditValue(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                            event.preventDefault()
                                            handleCancelEdit()
                                        }

                                        if (
                                            event.key === 'Enter' &&
                                            (event.metaKey || event.ctrlKey)
                                        ) {
                                            event.preventDefault()
                                            void saveInlineEdit()
                                        }
                                    }}
                                    className="text-foreground min-w-0 w-full max-w-full resize-none text-sm"
                                />
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        isIconOnly
                                        type="submit"
                                        variant="primary"
                                        className="h-9 w-9 min-w-9 rounded-full"
                                        isDisabled={
                                            isSaving ||
                                            !trimmedEditValue ||
                                            trimmedEditValue ===
                                                message.content.trim()
                                        }
                                    >
                                        <Check size={16} />
                                    </Button>
                                    <Button
                                        isIconOnly
                                        type="button"
                                        variant="outline"
                                        className="h-9 w-9 min-w-9 rounded-full"
                                        onPress={handleCancelEdit}
                                        isDisabled={isSaving}
                                    >
                                        <X size={16} />
                                    </Button>
                                </div>
                            </div>
                        </Form>
                    ) : (
                        <div className="ml-auto flex max-w-full items-start gap-2">
                            <div className="flex h-full w-8 shrink-0 items-start justify-center pt-2">
                                <div
                                    className={[
                                        'pointer-events-none transition-opacity',
                                        isMenuOpen
                                            ? 'opacity-100'
                                            : 'opacity-0 group-hover:opacity-100',
                                    ].join(' ')}
                                >
                                    <MessageMenu
                                        ownMessage
                                        onAction={handleOwnMessageAction}
                                        buttonClassName="pointer-events-auto text-default-500 hover:text-default-700 bg-default-50/90 hover:bg-default-100 border border-default-200/80"
                                        onOpenChange={setIsMenuOpen}
                                    />
                                </div>
                            </div>
                            <div
                                className={`bg-accent min-w-0 rounded-2xl rounded-br-md px-4 py-3 text-sm font-medium text-white shadow-sm ${MESSAGE_BUBBLE_MAX_WIDTH}`}
                            >
                                <p className="break-all whitespace-pre-wrap">
                                    {message.content}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <ConfirmDialog
                isOpen={isDeleteConfirmOpen}
                onOpenChange={setIsDeleteConfirmOpen}
                title={t('chat.deleteDialog.title')}
                message={t('chat.deleteDialog.message')}
                confirmLabel={t('chat.deleteDialog.confirm')}
                pendingConfirmLabel={t('chat.deleteDialog.pending')}
                cancelLabel={t('chat.deleteDialog.cancel')}
                confirmVariant="danger"
                isConfirmPending={isDeletePending}
                onConfirm={handleConfirmDelete}
            />
        </>
    )
}
