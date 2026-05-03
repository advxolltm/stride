import { Button, Surface } from '@heroui/react'
import { Check, Plus, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProjectSkillInput } from './skillUtils'

interface SkillOptionCardProps {
    skill: ProjectSkillInput
    isAdded: boolean
    isDisabled: boolean
    onAdd: (skill: ProjectSkillInput) => void
}

export function SkillOptionCard({
    skill,
    isAdded,
    isDisabled,
    onAdd,
}: Readonly<SkillOptionCardProps>) {
    const { t } = useTranslation('project')

    return (
        <Surface
            variant="transparent"
            className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5"
        >
            <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                <Sparkles size={15} />
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{skill.name}</p>
                {skill.description && (
                    <p className="text-muted-foreground truncate text-xs">
                        {skill.description}
                    </p>
                )}
            </div>

            {isAdded ? (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Check size={14} />
                    {t('skillsSettings.added')}
                </span>
            ) : (
                <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => onAdd(skill)}
                    isDisabled={isDisabled}
                    className="shrink-0 gap-1"
                >
                    <Plus size={14} />
                    {t('skillsSettings.add')}
                </Button>
            )}
        </Surface>
    )
}
