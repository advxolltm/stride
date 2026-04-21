import { SkillsAutocomplete } from '../../shared/SkillsAutocomplete'

interface ProjectSkillsCardProps {
    project: {
        id: string
        name: string
        skills: string[]
        selected: string[]
    }
    onChange: (values: string[]) => void
}

export function ProjectSkillsCard({
    project,
    onChange,
}: ProjectSkillsCardProps) {
    return (
        <div className="border-border bg-surface rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">{project.name}</h3>

                <span className="text-muted-foreground text-xs">
                    {project.selected.length} / {project.skills.length} selected
                </span>
            </div>

            <SkillsAutocomplete
                label="Select skills"
                placeholder="Select skills"
                searchPlaceholder="Search skills"
                options={project.skills}
                selectedSkills={project.selected}
                onChange={onChange}
            />
        </div>
    )
}
