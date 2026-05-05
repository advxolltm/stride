import { Inbox } from 'lucide-react'
import type { ProjectSkill } from '../../../../store/features/project/project.types'
import { SkillCard } from './SkillCard'

interface CurrentSkillsListProps {
    skills: ProjectSkill[]
    isOwner: boolean
    isAddingCustom: boolean
    emptyLabel: string
    onDelete: (skill: ProjectSkill) => void
}

export function CurrentSkillsList({
    skills,
    isOwner,
    isAddingCustom,
    emptyLabel,
    onDelete,
}: Readonly<CurrentSkillsListProps>) {
    return (
        <div className="flex flex-col gap-3">
            {skills.length > 0 &&
                skills.map((skill) => (
                    <SkillCard
                        key={skill.id}
                        name={skill.name}
                        description={skill.description}
                        isOwner={isOwner}
                        onDelete={() => onDelete(skill)}
                    />
                ))}

            {skills.length === 0 && !isAddingCustom && (
                <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center text-sm">
                    <Inbox size={28} />
                    <p>{emptyLabel}</p>
                </div>
            )}
        </div>
    )
}
