import { Button, Card, Spinner } from '@heroui/react'
import type { WhiteboardTemplateDefinition } from './whiteboardTemplates'

interface WhiteboardTemplateCardProps {
    template: WhiteboardTemplateDefinition
    isDisabled?: boolean
    isInserting?: boolean
    onPress?: (template: WhiteboardTemplateDefinition) => void
    ctaLabel: string
    insertingLabel: string
}

export function WhiteboardTemplateCard({
    template,
    isDisabled = false,
    isInserting = false,
    onPress,
    ctaLabel,
    insertingLabel,
}: Readonly<WhiteboardTemplateCardProps>) {
    return (
        <Card
            className={[
                'border-border bg-surface shrink-0 rounded-2xl border transition',
                isDisabled ? 'opacity-70' : 'hover:border-(--accent)/30 hover:shadow-md',
            ].join(' ')}
        >
            <Card.Header className="flex min-h-[8rem] flex-col items-stretch gap-3">
                <div className="min-w-0">
                    <Card.Title className="text-foreground text-base font-semibold">
                        {template.title}
                    </Card.Title>
                    <Card.Description className="text-default-500 mt-2 line-clamp-4 text-sm">
                        {template.description}
                    </Card.Description>
                </div>
                <div className="pt-1">
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-accent"
                        isDisabled={isDisabled}
                        aria-busy={isInserting}
                        onClick={() => onPress?.(template)}
                    >
                        {isInserting ? (
                            <>
                                <Spinner aria-label={ctaLabel} size="sm" />
                                <span>{insertingLabel}</span>
                            </>
                        ) : (
                            ctaLabel
                        )}
                    </Button>
                </div>
            </Card.Header>
        </Card>
    )
}
