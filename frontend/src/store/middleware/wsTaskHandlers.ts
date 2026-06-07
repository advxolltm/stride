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
import type {
    ApiTask,
    ApiTaskAssignee,
    ApiTaskSkill,
    Task,
} from '../features/tasks/task.types'
import { WSMessageType } from '../features/realtime/realtime.types'

export type WsListenerApi = {
    dispatch: (action: unknown) => unknown
    getState: () => unknown
}

type TaskDeletePayload = {
    deletedTaskID?: string
}

type TaskUnassignPayload = {
    taskID?: string
    projectMemberID?: string
}

type TaskSkillRemovedPayload = {
    task_id?: string
    taskId?: string
    project_skill_id?: string
    projectSkillId?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isApiTask = (value: unknown): value is ApiTask =>
    isRecord(value) && typeof value.id === 'string'

const isApiTaskList = (value: unknown): value is ApiTask[] =>
    Array.isArray(value) && value.every(isApiTask)

const isApiTaskAssignee = (value: unknown): value is ApiTaskAssignee =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.task_id === 'string' &&
    typeof value.project_member_id === 'string' &&
    typeof value.assigned_at === 'string'

const isApiTaskSkill = (value: unknown): value is ApiTaskSkill =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.task_id === 'string' &&
    typeof value.project_skill_id === 'string'

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
            if (!isApiTask(payload)) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const task = transformTask(payload)
            patchTaskCaches(api, projectId, task.id, (draft) => {
                patchTaskFields(draft, task)
            })
            return true
        }
        case WSMessageType.TaskDelete: {
            const taskId = (payload as TaskDeletePayload).deletedTaskID

            if (!taskId) {
                invalidateProjectTasks(api, projectId)
                return true
            }

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
            if (!isApiTask(payload) && !isApiTaskList(payload)) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const tasks = Array.isArray(payload)
                ? payload.map(transformTask)
                : [transformTask(payload)]
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
            if (!isApiTaskAssignee(payload)) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const project = getProject(api, projectId)
            const member = project?.members.find(
                (item) => item.id === payload.project_member_id,
            )
            if (!member) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const assignee = {
                ...mapProjectMemberToTaskAssignee(
                    member,
                    payload.task_id,
                    payload.id,
                ),
                assignedAt: payload.assigned_at,
            }

            patchTaskCaches(api, projectId, payload.task_id, (task) => {
                applyTaskAssignee(task, assignee)
            })
            return true
        }
        case WSMessageType.TaskUnassign: {
            const taskId = (payload as TaskUnassignPayload).taskID
            const projectMemberId = (payload as TaskUnassignPayload)
                .projectMemberID

            if (!taskId || !projectMemberId) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            patchTaskCaches(api, projectId, taskId, (task) => {
                removeTaskAssignee(task, projectMemberId)
            })
            return true
        }
        case WSMessageType.TaskSkillAdded: {
            if (!isApiTaskSkill(payload)) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const project = getProject(api, projectId)
            const projectSkill = project?.skills.find(
                (skill) => skill.id === payload.project_skill_id,
            )
            if (!projectSkill) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            const skill = mapProjectSkillToTaskSkill(
                projectSkill,
                payload.task_id,
                payload.id,
            )

            patchTaskCaches(api, projectId, payload.task_id, (task) => {
                applyTaskSkill(task, skill)
            })
            return true
        }
        case WSMessageType.TaskSkillRemoved: {
            const taskId =
                (payload as TaskSkillRemovedPayload).task_id ??
                (payload as TaskSkillRemovedPayload).taskId
            const projectSkillId =
                (payload as TaskSkillRemovedPayload).project_skill_id ??
                (payload as TaskSkillRemovedPayload).projectSkillId

            if (!taskId || !projectSkillId) {
                invalidateProjectTasks(api, projectId)
                return true
            }

            patchTaskCaches(api, projectId, taskId, (task) => {
                removeTaskSkill(task, projectSkillId)
            })
            return true
        }
        default:
            return false
    }
}
