import type {
    SchedulerAssignment,
    SchedulerMemberOption,
    SchedulerTaskOption,
    SchedulerTriggerRequest,
} from './types'

export function buildSchedulerTriggerRequest(
    tasks: SchedulerTaskOption[],
    members: SchedulerMemberOption[],
): SchedulerTriggerRequest {
    return {
        task_ids: tasks.map((task) => task.id),
        user_ids: members.map((member) => member.id),
    }
}

export function buildMockSchedulerAssignments(
    request: SchedulerTriggerRequest,
    members: SchedulerMemberOption[],
): SchedulerAssignment[] {
    const preferredUserOrder = ['sk', 'mr', 'at', 'lm', 'jc']
    const fallbackUserId = members[0]?.id

    if (!fallbackUserId) {
        return []
    }

    const eligibleUserIds = preferredUserOrder.filter((userId) =>
        request.user_ids.includes(userId),
    )

    const resolvedUserIds =
        eligibleUserIds.length > 0 ? eligibleUserIds : [fallbackUserId]

    return request.task_ids.map((taskId, index) => ({
        user_id: resolvedUserIds[index % resolvedUserIds.length],
        task_id: taskId,
    }))
}
