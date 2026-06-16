import type {
    Task,
    TaskAssignee,
    TaskSkill,
    UpdateTaskRequest,
} from './task.types'

export const patchTask = (task: Task, updatedTask: Task) => {
    Object.assign(task, updatedTask)
}

// Some responses only tell us about the task itself. Keep assignees and skills
// as they are so we do not accidentally wipe data the response did not include.
export const patchTaskFields = (task: Task, updatedTask: Task) => {
    task.title = updatedTask.title
    task.description = updatedTask.description
    task.status = updatedTask.status
    task.startDate = updatedTask.startDate
    task.dueDate = updatedTask.dueDate
    task.expectedDurationHours = updatedTask.expectedDurationHours
    task.position = updatedTask.position
    task.updatedAt = updatedTask.updatedAt
    task.completedAt = updatedTask.completedAt
}

export const applyTaskAssignee = (task: Task, assignee: TaskAssignee) => {
    task.assignees ??= []

    // One project member should only appear once on a task.
    const existingIndex = task.assignees.findIndex(
        (item) => item.projectMemberId === assignee.projectMemberId,
    )

    if (existingIndex === -1) {
        task.assignees.push(assignee)
        return
    }

    task.assignees[existingIndex] = assignee
}

export const removeTaskAssignee = (task: Task, projectMemberId: string) => {
    task.assignees =
        task.assignees?.filter(
            (assignee) => assignee.projectMemberId !== projectMemberId,
        ) ?? []
}

export const applyTaskSkill = (task: Task, skill: TaskSkill) => {
    task.skills ??= []

    // One project skill should only appear once on a task.
    const existingIndex = task.skills.findIndex(
        (item) => item.projectSkillId === skill.projectSkillId,
    )

    if (existingIndex === -1) {
        task.skills.push(skill)
        return
    }

    task.skills[existingIndex] = skill
}

export const removeTaskSkill = (task: Task, projectSkillId: string) => {
    task.skills =
        task.skills?.filter((skill) => skill.projectSkillId !== projectSkillId) ??
        []
}

const hasOwn = <T extends object>(object: T, key: keyof T) =>
    Object.prototype.hasOwnProperty.call(object, key)

export const applyTaskUpdate = (task: Task, update: UpdateTaskRequest) => {
    // Omitted fields mean "leave as-is"; null means "clear this value".
    if (hasOwn(update, 'title')) {
        task.title = update.title ?? ''
    }
    if (hasOwn(update, 'description')) {
        task.description = update.description ?? null
    }
    if (hasOwn(update, 'status') && update.status) {
        task.status = update.status
    }
    if (hasOwn(update, 'start_date')) {
        task.startDate = update.start_date ?? null
    }
    if (hasOwn(update, 'due_date')) {
        task.dueDate = update.due_date ?? null
    }
    if (hasOwn(update, 'expected_duration_hours')) {
        task.expectedDurationHours = update.expected_duration_hours ?? null
    }
}

export const applyTaskMove = (
    tasks: Task[],
    taskId: string,
    position: number,
) => {
    // Mirror the drag result locally by reordering the cached tasks and positions.
    const sortedTasks = [...tasks].sort((a, b) => a.position - b.position)
    const currentIndex = sortedTasks.findIndex((task) => task.id === taskId)

    if (currentIndex === -1) return

    const targetIndex = Math.max(0, Math.min(position, sortedTasks.length - 1))
    const [movedTask] = sortedTasks.splice(currentIndex, 1)
    sortedTasks.splice(targetIndex, 0, movedTask)

    sortedTasks.forEach((task, index) => {
        const draftTask = tasks.find((item) => item.id === task.id)
        if (draftTask) {
            draftTask.position = index
        }
    })
}
