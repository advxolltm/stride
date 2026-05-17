import { Tabs } from '@heroui/react'
import { LayoutTemplate, MessageSquareText, Pin, PinOff, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChatSpace } from '../chat/ChatSpace'
import { PanelActionButton } from '../shared/PanelActionButton'
import type { WhiteboardTemplateDefinition } from './whiteboardTemplates'

export type WhiteboardPanelTab = 'chat' | 'templates'

interface WhiteboardWorkspacePanelProps {
    projectId: string
    isPinned: boolean
    canDock: boolean
    selectedTab: WhiteboardPanelTab
    onTabChange: (tab: WhiteboardPanelTab) => void
    onTogglePin: () => void
    onClose: () => void
    className?: string
    chromeClassName?: string
    bodyClassName?: string
    chatVariant?: 'page' | 'embedded' | 'drawer'
    templates?: WhiteboardTemplateDefinition[]
    onInsertTemplate?: (template: WhiteboardTemplateDefinition) => void
}

export function WhiteboardWorkspacePanel({
    projectId,
    isPinned,
    canDock,
    selectedTab,
    onTabChange,
    onTogglePin,
    onClose,
    className,
    chromeClassName,
    bodyClassName,
    chatVariant = 'page',
    templates = [],
    onInsertTemplate,
}: WhiteboardWorkspacePanelProps) {
    const { t } = useTranslation('project')

    return (
        <div
            className={[
                'flex h-full min-h-0 flex-col overflow-hidden',
                className ?? '',
            ].join(' ')}
        >
            <div
                className={[
                    'border-border flex items-center justify-between gap-3 border-b px-4 py-3',
                    chromeClassName ?? '',
                ].join(' ')}
            >
                <div className="min-w-0">
                    <div className="text-foreground truncate text-base font-semibold">
                        {t('whiteboardPage.panel.title')}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {canDock ? (
                        <PanelActionButton
                            label={
                                isPinned
                                    ? t('whiteboardPage.panel.unpin')
                                    : t('whiteboardPage.panel.pin')
                            }
                            icon={isPinned ? PinOff : Pin}
                            onPress={onTogglePin}
                        />
                    ) : null}
                    <PanelActionButton
                        label={t('whiteboardPage.panel.close')}
                        icon={X}
                        onPress={onClose}
                    />
                </div>
            </div>

            <Tabs
                className="flex min-h-0 flex-1 flex-col"
                selectedKey={selectedTab}
                onSelectionChange={(key) =>
                    onTabChange(String(key) as WhiteboardPanelTab)
                }
                variant="secondary"
            >
                <div className="shrink-0 px-4 pt-2">
                    <Tabs.ListContainer>
                        <Tabs.List
                            aria-label={t('whiteboardPage.panel.tabsAriaLabel')}
                            className="flex gap-4"
                        >
                            <Tabs.Tab id="chat">
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <MessageSquareText size={16} />
                                    {t('whiteboardPage.panel.tabs.chat')}
                                </div>
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab id="templates">
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <LayoutTemplate size={16} />
                                    {t('whiteboardPage.panel.tabs.templates')}
                                </div>
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs.ListContainer>
                </div>

                <Tabs.Panel id="chat" className="flex min-h-0 flex-1 flex-col p-0">
                    <ChatSpace projectId={projectId} variant={chatVariant} />
                </Tabs.Panel>

                <Tabs.Panel
                    id="templates"
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div
                        className={[
                            'flex h-full flex-col gap-4 overflow-y-auto px-4 py-4',
                            bodyClassName ?? '',
                        ].join(' ')}
                    >
                        {templates.length === 0 ? (
                            <div className="flex h-full items-center justify-center px-6 text-center">
                                <div>
                                    <div className="text-foreground text-base font-semibold">
                                        {t('whiteboardPage.panel.templatesTitle')}
                                    </div>
                                    <div className="text-default-500 mt-2 text-sm">
                                        {t(
                                            'whiteboardPage.panel.templatesComingSoon',
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            templates.map((template) => (
                                <button
                                    key={template.id}
                                    type="button"
                                    className="border-border bg-surface text-left rounded-2xl border p-4 shadow-sm transition hover:border-(--accent)/30 hover:shadow-md"
                                    onClick={() => onInsertTemplate?.(template)}
                                >
                                    <div className="text-foreground text-base font-semibold">
                                        {template.title}
                                    </div>
                                    <div className="text-default-500 mt-2 text-sm">
                                        {template.description}
                                    </div>
                                    <div className="text-accent mt-4 text-sm font-medium">
                                        {t('whiteboardPage.panel.useTemplate')}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </Tabs.Panel>
            </Tabs>
        </div>
    )
}
