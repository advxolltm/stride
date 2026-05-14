import type { ProjectSkill } from '../../store/features/project/project.types'
import { SkillsAutocomplete } from './SkillsAutocomplete'

interface ProjectSkillSelectionCardProps {
    title: string
    skills: ProjectSkill[]
    selectedSkillIds: string[]
    onChange: (values: string[]) => void
    label: string
    placeholder: string
    searchPlaceholder: string
    selectedLabel: string
    emptyStateMessage?: string
}

export function ProjectSkillSelectionCard({
    title,
    skills,
    selectedSkillIds,
    onChange,
    label,
    placeholder,
    searchPlaceholder,
    selectedLabel,
    emptyStateMessage,
}: Readonly<ProjectSkillSelectionCardProps>) {
    return (
        <div className="border-border bg-surface rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">{title}</h3>

                <span className="text-muted-foreground text-xs">
                    {selectedLabel}
                </span>
            </div>

            <SkillsAutocomplete
                label={label}
                placeholder={placeholder}
                searchPlaceholder={searchPlaceholder}
                emptyStateMessage={emptyStateMessage}
                options={skills.map((skill) => ({
                    id: skill.id,
                    label: skill.name,
                }))}
                selectedSkills={selectedSkillIds}
                onChange={onChange}
            />
        </div>
    )
}
