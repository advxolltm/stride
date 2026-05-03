import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { skillTemplateGroups } from './skillTemplates'
import type { ProjectSkillInput } from './skillUtils'
import { getMissingSkills, isSkillAdded } from './skillUtils'
import { SkillOptionCard } from './SkillOptionCard'
import { SkillSearchInput } from './SkillSearchInput'

interface TemplateSkillsPanelProps {
    addedSkillNames: Set<string>
    isCreatingProjectSkill: boolean
    addProjectSkill: (skill: ProjectSkillInput) => void
    addProjectSkills: (skills: ProjectSkillInput[]) => void
}

export function TemplateSkillsPanel({
    addedSkillNames,
    isCreatingProjectSkill,
    addProjectSkill,
    addProjectSkills,
}: Readonly<TemplateSkillsPanelProps>) {
    const { t } = useTranslation('project')
    const [activeGroupId, setActiveGroupId] = useState(
        skillTemplateGroups[0]?.id ?? '',
    )
    const [search, setSearch] = useState('')

    const activeGroup =
        skillTemplateGroups.find((group) => group.id === activeGroupId) ??
        skillTemplateGroups[0]

    const query = search.trim().toLocaleLowerCase()
    const filteredSkills = query
        ? activeGroup.skills.filter(
              (skill) =>
                  skill.name.toLocaleLowerCase().includes(query) ||
                  skill.description.toLocaleLowerCase().includes(query),
          )
        : activeGroup.skills

    const missingGroupSkills = getMissingSkills(
        activeGroup.skills,
        addedSkillNames,
    )

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            <SkillSearchInput
                search={search}
                searchPlaceholder={t('skillsSettings.searchTemplates')}
                onSearchChange={setSearch}
            />

            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {skillTemplateGroups.map((group) => (
                        <Button
                            key={group.id}
                            size="sm"
                            variant={
                                group.id === activeGroup.id
                                    ? 'primary'
                                    : 'secondary'
                            }
                            onPress={() => setActiveGroupId(group.id)}
                        >
                            {group.label}
                        </Button>
                    ))}
                </div>

                <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => addProjectSkills(missingGroupSkills)}
                    isDisabled={
                        missingGroupSkills.length === 0 ||
                        isCreatingProjectSkill
                    }
                    className="shrink-0"
                >
                    {t('skillsSettings.addAll')}
                </Button>
            </div>

            <p className="text-muted-foreground text-xs">
                {activeGroup.description}
            </p>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 [scrollbar-gutter:auto]">
                {filteredSkills.map((skill) => (
                    <SkillOptionCard
                        key={skill.name}
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
