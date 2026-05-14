import { ProjectSkillSelectionCard } from '../../shared/ProjectSkillSelectionCard'
import type { ProjectSkill } from '../../../store/features/project/project.types'

interface ProjectSkillsCardProps {
    project: {
        id: string
        name: string
        skills: ProjectSkill[]
        selected: string[]
    }
    onChange: (values: string[]) => void
    label: string
    placeholder: string
    searchPlaceholder: string
    selectedLabel: string
    emptyStateMessage?: string
}

export function ProjectSkillsCard({
    project,
    onChange,
    label,
    placeholder,
    searchPlaceholder,
    selectedLabel,
    emptyStateMessage,
}: ProjectSkillsCardProps) {
    return (
        <ProjectSkillSelectionCard
            title={project.name}
            skills={project.skills}
            selectedSkillIds={project.selected}
            onChange={onChange}
            label={label}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            selectedLabel={selectedLabel}
            emptyStateMessage={emptyStateMessage}
        />
    )
}
