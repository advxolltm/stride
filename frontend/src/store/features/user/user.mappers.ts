import type { User } from '../../../shared/types'
import type { ApiUser, ApiUserSkill, UserSkill } from './user.types'

export const mapApiUserToUser = ({
    id,
    username,
    email,
    full_name,
    avatar_url,
}: ApiUser): User => ({
    id,
    username,
    email,
    fullName: full_name,
    avatarUrl: avatar_url?.original ?? null,
    avatarSmallUrl: avatar_url?.[300] ?? avatar_url?.original ?? null,
})

export const mapApiUserSkillToUserSkill = ({
    id,
    user_id,
    project_skill_id,
    project_skill,
}: ApiUserSkill): UserSkill => ({
    id,
    userId: user_id,
    projectSkillId: project_skill_id,
    projectSkill: {
        id: project_skill.id,
        projectId: project_skill.project_id,
        name: project_skill.name,
        description: project_skill.description,
    },
})
