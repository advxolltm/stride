import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Project } from '../../../../store/features/project/project.types'
import type { ProjectSkillInput } from './skillUtils'
import { getMissingSkills, isSkillAdded } from './skillUtils'
import { SkillOptionCard } from './SkillOptionCard'
import { SkillSearchInput } from './SkillSearchInput'

interface ProjectSkillsPanelProps {
    currentProjectId: string
    projects: Project[]
    addedSkillNames: Set<string>
    isCreatingProjectSkill: boolean
    addProjectSkill: (skill: ProjectSkillInput) => void
    addProjectSkills: (skills: ProjectSkillInput[]) => void
}

export function ProjectSkillsPanel({
    currentProjectId,
    projects,
    addedSkillNames,
    isCreatingProjectSkill,
    addProjectSkill,
    addProjectSkills,
}: Readonly<ProjectSkillsPanelProps>) {
    const { t } = useTranslation('project')
    const reusableProjects = projects.filter(
        (project) =>
            project.id !== currentProjectId &&
            (project.skills?.length ?? 0) > 0,
    )
    const [activeProjectId, setActiveProjectId] = useState(
        reusableProjects[0]?.id ?? '',
    )
    const [search, setSearch] = useState('')

    const activeProject =
        reusableProjects.find((project) => project.id === activeProjectId) ??
        reusableProjects[0]

    const query = search.trim().toLocaleLowerCase()
    const activeProjectSkills = activeProject
        ? activeProject.skills.map((skill) => ({
              name: skill.name,
              description: skill.description,
          }))
        : []

    const filteredSkills = query
        ? activeProjectSkills.filter(
              (skill) =>
                  skill.name.toLocaleLowerCase().includes(query) ||
                  skill.description?.toLocaleLowerCase().includes(query),
          )
        : activeProjectSkills

    const missingProjectSkills = getMissingSkills(
        activeProjectSkills,
        addedSkillNames,
    )

    if (reusableProjects.length === 0) {
        return (
            <p className="text-muted-foreground py-6 text-center text-sm">
                {t('skillsSettings.noProjectSkills')}
            </p>
        )
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            <SkillSearchInput
                search={search}
                searchPlaceholder={t('skillsSettings.searchProjects')}
                onSearchChange={setSearch}
            />

            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {reusableProjects.map((project) => (
                        <Button
                            key={project.id}
                            size="sm"
                            variant={
                                project.id === activeProject.id
                                    ? 'primary'
                                    : 'secondary'
                            }
                            onPress={() => setActiveProjectId(project.id)}
                        >
                            {project.name}
                        </Button>
                    ))}
                </div>

                <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => addProjectSkills(missingProjectSkills)}
                    isDisabled={
                        missingProjectSkills.length === 0 ||
                        isCreatingProjectSkill
                    }
                    className="shrink-0"
                >
                    {t('skillsSettings.addAll')}
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 [scrollbar-gutter:auto]">
                {filteredSkills.map((skill) => (
                    <SkillOptionCard
                        key={`${activeProject.id}-${skill.name}`}
                        skill={skill}
                        isAdded={isSkillAdded(skill, addedSkillNames)}
                        isDisabled={isCreatingProjectSkill}
                        onAdd={addProjectSkill}
                    />
                ))}

                {filteredSkills.length === 0 && (
                    <p className="text-muted-foreground py-6 text-center text-sm">
                        {t('skillsSettings.noSkillsFound')}
                    </p>
                )}
            </div>
        </div>
    )
}
