import type { ProjectSkill } from '../../../../store/features/project/project.types'

export type ProjectSkillInput = {
    name: string
    description: string | null
}

export const normalizeSkillName = (name: string) =>
    name.trim().toLocaleLowerCase()

export const getAddedSkillNames = (skills: ProjectSkill[]) =>
    new Set(skills.map((skill) => normalizeSkillName(skill.name)))

export const isSkillAdded = (
    skill: ProjectSkillInput,
    addedSkillNames: Set<string>,
) => addedSkillNames.has(normalizeSkillName(skill.name))

export const getMissingSkills = (
    skills: ProjectSkillInput[],
    addedSkillNames: Set<string>,
) => skills.filter((skill) => !isSkillAdded(skill, addedSkillNames))
