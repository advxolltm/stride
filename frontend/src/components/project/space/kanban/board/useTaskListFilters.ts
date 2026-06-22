import { useCallback, useMemo, useState } from 'react'
import type {
    Task,
    TaskAssignee,
    TaskSkill,
} from '../../../../../store/features/tasks/task.types'
import type {
    ProjectMember,
    ProjectSkill,
} from '../../../../../store/features/project/project.types'

export function useTaskListFilters(
    tasks: Task[],
    members?: ProjectMember[],
    skills?: ProjectSkill[],
) {
    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
        new Set(),
    )
    const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(
        new Set(),
    )
    const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(
        new Set(),
    )

    const uniqueAssignees = useMemo(() => {
        const seen = new Map<string, TaskAssignee>()
        for (const member of members ?? []) {
            if (!seen.has(member.user.id)) {
                seen.set(member.user.id, {
                    id: member.id,
                    taskId: '',
                    projectMemberId: member.id,
                    assignedAt: '',
                    user: { ...member.user, isSuperuser: false },
                })
            }
        }
        for (const task of tasks) {
            for (const assignee of task.assignees ?? []) {
                if (!seen.has(assignee.user.id)) {
                    seen.set(assignee.user.id, assignee)
                }
            }
        }
        return Array.from(seen.values())
    }, [tasks, members])

    const uniqueSkills = useMemo(() => {
        const seen = new Map<string, TaskSkill>()
        for (const skill of skills ?? []) {
            if (!seen.has(skill.id)) {
                seen.set(skill.id, {
                    id: skill.id,
                    taskId: '',
                    projectSkillId: skill.id,
                    name: skill.name,
                    description: skill.description,
                })
            }
        }
        for (const task of tasks) {
            for (const skill of task.skills ?? []) {
                if (!seen.has(skill.id)) {
                    seen.set(skill.id, skill)
                }
            }
        }
        return Array.from(seen.values())
    }, [tasks, skills])

    const filteredTasks = useMemo(() => {
        let result = tasks
        if (selectedStatuses.size > 0) {
            result = result.filter((task) =>
                selectedStatuses.has(task.status),
            )
        }
        if (selectedAssigneeIds.size > 0) {
            result = result.filter((task) =>
                (task.assignees ?? []).some((a) =>
                    selectedAssigneeIds.has(a.user.id),
                ),
            )
        }
        if (selectedSkillIds.size > 0) {
            result = result.filter((task) =>
                (task.skills ?? []).some((s) =>
                    selectedSkillIds.has(s.id),
                ),
            )
        }
        return result
    }, [tasks, selectedStatuses, selectedAssigneeIds, selectedSkillIds])

    const hasActiveFilters =
        selectedStatuses.size > 0 ||
        selectedAssigneeIds.size > 0 ||
        selectedSkillIds.size > 0

    const clearAllFilters = useCallback(() => {
        setSelectedStatuses(new Set())
        setSelectedAssigneeIds(new Set())
        setSelectedSkillIds(new Set())
    }, [])

    const handleStatusFilterChange = useCallback(
        (keys: Set<string>) => setSelectedStatuses(keys),
        [],
    )

    const handleAssigneeFilterChange = useCallback(
        (keys: Set<string>) => setSelectedAssigneeIds(keys),
        [],
    )

    const handleSkillFilterChange = useCallback(
        (keys: Set<string>) => setSelectedSkillIds(keys),
        [],
    )

    return {
        selectedStatuses,
        selectedAssigneeIds,
        selectedSkillIds,
        uniqueAssignees,
        uniqueSkills,
        filteredTasks,
        hasActiveFilters,
        clearAllFilters,
        handleStatusFilterChange,
        handleAssigneeFilterChange,
        handleSkillFilterChange,
    }
}
