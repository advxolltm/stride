import getInitials from '../../../../../shared/utils/getInitials'
import type {
    ProjectMember,
    SchedulerAssignment,
    SchedulerPreviewResponse,
    SchedulerScheduleRequest,
} from '../../../../../store/features/project/project.types'
import type { Task } from '../../../../../store/features/tasks/task.types'
import type { StatusOption } from '../context/taskBoard.types'
import type { SchedulerMemberOption, SchedulerTaskOption } from './types'

const DEFAULT_SCHEDULER_SETTINGS: SchedulerScheduleRequest['settings'] = {
    optimization_goals: ['max-hours-scheduled', 'distribute-evenly'],
}

export function mapTaskToSchedulerTaskOption(
    task: Task,
    statusOptions: StatusOption[],
): SchedulerTaskOption {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        startDate: task.startDate,
        expectedDurationHours: task.expectedDurationHours,
        statusLabel:
            statusOptions.find((option) => option.id === task.status)?.label ??
            task.status,
    }
}

export function mapProjectMemberToSchedulerMemberOption(
    member: ProjectMember,
): SchedulerMemberOption {
    const name = member.user.fullName ?? member.user.username

    return {
        id: member.userId,
        name,
        initials: getInitials(name),
        avatarUrl: member.user.avatarSmallUrl ?? member.user.avatarUrl,
        workingHours: member.workingHours,
    }
}

export function buildSchedulerTriggerRequest(
    tasks: SchedulerTaskOption[],
    members: SchedulerMemberOption[],
): SchedulerScheduleRequest {
    return {
        task_ids: tasks.map((task) => task.id),
        user_ids: members.map((member) => member.id),
        settings: DEFAULT_SCHEDULER_SETTINGS,
    }
}

export function flattenSchedulerAssignments(
    response: SchedulerPreviewResponse,
): SchedulerAssignment[] {
    return [...response.newAssignments, ...response.changedAssignments]
}
