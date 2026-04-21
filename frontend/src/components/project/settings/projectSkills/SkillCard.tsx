import { Button, Surface } from '@heroui/react'
import { Sparkles, Trash2 } from 'lucide-react'

interface SkillCardProps {
    name: string
    description?: string | null
    isOwner: boolean
    onDelete: () => void
}

export function SkillCard({
    name,
    description,
    isOwner,
    onDelete,
}: Readonly<SkillCardProps>) {
    return (
        <Surface
            variant="transparent"
            className="flex items-center gap-3 rounded-xl border p-4"
        >
            <Sparkles size={15} className="text-primary" />
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{name}</span>
                {description && (
                    <span className="text-muted-foreground truncate text-xs">
                        {description}
                    </span>
                )}
            </div>
            {isOwner && (
                <Button isIconOnly variant="ghost" onClick={onDelete}>
                    <Trash2 />
                </Button>
            )}
        </Surface>
    )
}
