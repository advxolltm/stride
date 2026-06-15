import { baseApi } from '../api/base.api'
import { projectApi } from '../features/project/project.api'
import {
    applyTaskAssignee,
    applyTaskSkill,
    patchTask,
    patchTaskFields,
    removeTaskAssignee,
    removeTaskSkill,
} from '../features/tasks/task.cache'
import { taskApi } from '../features/tasks/task.api'
import {
    mapProjectMemberToTaskAssignee,
    mapProjectSkillToTaskSkill,
    transformTask,
} from '../features/tasks/task.mappers'
import {
    ApiTaskAssigneeSchema,
    ApiTaskListSchema,
    ApiTaskSchema,
    ApiTaskSkillSchema,
    type Task,
} from '../features/tasks/task.types'
import { WSMessageType } from '../features/realtime/realtime.types'

import { z } from 'zod'

export type WsListenerApi = {
    dispatch: (action: unknown) => unknown
    getState: () => unknown
}

const TaskDeletePayloadSchema = z.object({
    deletedTaskID: z.string(),
})

const TaskUnassignPayloadSchema = z.object({
    taskID: z.string(),
    projectMemberID: z.string(),
})

const TaskSkillRemovedPayloadSchema = z.union([
    z.object({
        task_id: z.string(),
        project_skill_id: z.string(),
    }),
    z.object({
        taskId: z.string(),
        projectSkillId: z.string(),
    }),
])

const invalidateProjectTasks = (api: WsListenerApi, projectId: string) => {
    api.dispatch(baseApi.util.invalidateTags([{ type: 'Task', id: projectId }]))
}

const patchTaskCaches = (
    api: WsListenerApi,
    projectId: string,
    taskId: string,
    apply: (task: Task) => void,
) => {
    api.dispatch(
        taskApi.util.updateQueryData(
            'getTasksForProject',
            projectId,
            (draft) => {
                const task = draft.find((item) => item.id === taskId)
                if (task) apply(task)
            },
        ),
    )
    api.dispatch(
        taskApi.util.updateQueryData('getTask', taskId, (draft) => {
            apply(draft)
        }),
    )
}

const getProject = (api: WsListenerApi, projectId: string) =>
    projectApi.endpoints.getProjectById.select(projectId)(
        api.getState() as never,
    ).data

export function handleTaskWsMessage(
    type: number,
    payload: unknown,
    projectId: string,
    api: WsListenerApi,
) {
    switch (type) {
        case WSMessageType.TaskCreate: {
            // Create can shift other task positions, and the current WS payload
            // only contains the new task. Refetch the list until the backend sends
            // the final created task plus affected positions or the full final list.
            // TODO: Decide the best create-event payload so this can become a cache patch.
            invalidateProjectTasks(api, projectId)
            return true
        }
        case WSMessageType.TaskUpdate: {
            const parsedPayload = ApiTaskSchema.safeParse(payload)
            if (!parsedPayload.success) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const task = transformTask(parsedPayload.data)
            patchTaskCaches(api, projectId, task.id, (draft) => {
                patchTaskFields(draft, task)
            })
            return true
        }
        case WSMessageType.TaskDelete: {
            const parsedPayload = TaskDeletePayloadSchema.safeParse(payload)

            if (!parsedPayload.success) {
                invalidateProjectTasks(api, projectId)
                return true
            }
            const { deletedTaskID: taskId } = parsedPayload.data

            api.dispatch(
                taskApi.util.updateQueryData(
                    'getTasksForProject',
                    projectId,
                    (draft) => draft.filter((task) => task.id !== taskId),
                ),
            )
            return true
        }
        case WSMessageType.TaskMove: {
            const parsedSingleTask = ApiTaskSchema.safeParse(payload)
            const parsedTaskList = ApiTaskListSchema.safeParse(payload)

            if (!parsedSingleTask.success && !parsedTaskList.success) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const tasks = parsedTaskList.success
                ? parsedTaskList.data.map(transformTask)
                : parsedSingleTask.success
                  ? [transformTask(parsedSingleTask.data)]
                  : []
            api.dispatch(
                taskApi.util.updateQueryData(
                    'getTasksForProject',
                    projectId,
                    (draft) => {
                        for (const task of tasks) {
                            const existingIndex = draft.findIndex(
                                (item) => item.id === task.id,
                            )

                            if (existingIndex === -1) {
                                draft.push(task)
                            } else {
                                patchTask(draft[existingIndex], task)
                            }
                        }
                    },
                ),
            )
            for (const task of tasks) {
                api.dispatch(
                    taskApi.util.updateQueryData(
                        'getTask',
                        task.id,
                        (draft) => {
                            patchTask(draft, task)
                        },
                    ),
                )
            }
            return true
        }
        case WSMessageType.TaskAssign: {
            const parsedPayload = ApiTaskAssigneeSchema.safeParse(payload)
            if (!parsedPayload.success) {
                invalidateProjectTasks(api, projectId)
                return true
            }
            const assignment = parsedPayload.data

            const project = getProject(api, projectId)
            const member = project?.members.find(
                (item) => item.id === assignment.project_member_id,
            )
            if (!member) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const assignee = {
                ...mapProjectMemberToTaskAssignee(
                    member,
                    assignment.task_id,
                    assignment.id,
                ),
                assignedAt: assignment.assigned_at,
            }

            patchTaskCaches(api, projectId, assignment.task_id, (task) => {
                applyTaskAssignee(task, assignee)
            })
            return true
        }
        case WSMessageType.TaskUnassign: {
            const parsedPayload = TaskUnassignPayloadSchema.safeParse(payload)

            if (!parsedPayload.success) {
                invalidateProjectTasks(api, projectId)
                return true
            }
            const { taskID: taskId, projectMemberID: projectMemberId } =
                parsedPayload.data

            patchTaskCaches(api, projectId, taskId, (task) => {
                removeTaskAssignee(task, projectMemberId)
            })
            return true
        }
        case WSMessageType.TaskSkillAdded: {
            const parsedPayload = ApiTaskSkillSchema.safeParse(payload)
            if (!parsedPayload.success) {
                invalidateProjectTasks(api, projectId)
                return true
            }
            const taskSkill = parsedPayload.data

            const project = getProject(api, projectId)
            const projectSkill = project?.skills.find(
                (skill) => skill.id === taskSkill.project_skill_id,
            )
            if (!projectSkill) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const skill = mapProjectSkillToTaskSkill(
                projectSkill,
                taskSkill.task_id,
                taskSkill.id,
            )

            patchTaskCaches(api, projectId, taskSkill.task_id, (task) => {
                applyTaskSkill(task, skill)
            })
            return true
        }
        case WSMessageType.TaskSkillRemoved: {
            const parsedPayload = TaskSkillRemovedPayloadSchema.safeParse(payload)

            if (!parsedPayload.success) {
                invalidateProjectTasks(api, projectId)
                return true
            }
            const taskId =
                'task_id' in parsedPayload.data
                    ? parsedPayload.data.task_id
                    : parsedPayload.data.taskId
            const projectSkillId =
                'project_skill_id' in parsedPayload.data
                    ? parsedPayload.data.project_skill_id
                    : parsedPayload.data.projectSkillId

            patchTaskCaches(api, projectId, taskId, (task) => {
                removeTaskSkill(task, projectSkillId)
            })
            return true
        }
        default:
            return false
    }
}
