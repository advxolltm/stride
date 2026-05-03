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
                <p className="py-4 text-center text-sm">{emptyLabel}</p>
            )}
        </div>
    )
}
