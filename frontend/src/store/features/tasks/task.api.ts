import { baseApi } from '../../api/base.api'
import type {
    ApiTask,
    ApiTaskAssignee,
    AssignTaskRequest,
    CreateTaskRequest,
    MoveTaskRequest,
    Task,
    TaskAssignee,
    UnassignTaskRequest,
    UpdateTaskRequest,
} from './task.types'

const transformTaskAssignee = (a: ApiTaskAssignee): TaskAssignee => ({
    id: a.id,
    taskId: a.task_id,
    projectMemberId: a.project_member_id,
    assignedAt: a.assigned_at,
})

const transformTask = (task: ApiTask): Task => ({
    id: task.id,
    projectId: task.project_id,
    createdBy: task.created_by,
    title: task.title,
    description: task.description,
    status: task.status as Task['status'],
    startDate: task.start_date,
    dueDate: task.due_date,
    expectedDurationMinutes: task.expected_duration_minutes,
    position: task.position,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    assignees: task.assignees?.map(transformTaskAssignee) ?? [],
})

const hasOwn = <T extends object>(object: T, key: keyof T) =>
    Object.prototype.hasOwnProperty.call(object, key)

const applyTaskUpdate = (task: Task, update: UpdateTaskRequest) => {
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
    if (hasOwn(update, 'expected_duration_minutes')) {
        task.expectedDurationMinutes = update.expected_duration_minutes ?? null
    }
}

const applyTaskMove = (tasks: Task[], taskId: string, position: number) => {
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

export const taskApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getTasksForProject: builder.query<Task[], string>({
            query: (projectId) => `/tasks/for-project/${projectId}`,
            transformResponse: (response: ApiTask[]) =>
                response.map(transformTask),
            providesTags: (_result, _error, projectId) => [
                { type: 'Task' as const, id: projectId },
            ],
        }),

        getTask: builder.query<Task, string>({
            query: (taskId) => `/tasks/task/${taskId}`,
            transformResponse: (response: ApiTask) => transformTask(response),
            providesTags: (_result, _error, taskId) => [
                { type: 'Task' as const, id: taskId },
            ],
        }),

        createTask: builder.mutation<Task, CreateTaskRequest>({
            query: (body) => ({
                url: '/tasks/task',
                method: 'POST',
                body,
            }),
            transformResponse: (response: ApiTask) => transformTask(response),
            invalidatesTags: (_result, _error, { project_id }) => [
                { type: 'Task' as const, id: project_id },
            ],
        }),

        updateTask: builder.mutation<
            Task,
            { taskId: string; projectId: string; body: UpdateTaskRequest }
        >({
            query: ({ taskId, body }) => ({
                url: `/tasks/task/${taskId}`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (response: ApiTask) => transformTask(response),
            invalidatesTags: (_result, _error, { taskId, projectId }) => [
                { type: 'Task' as const, id: taskId },
                { type: 'Task' as const, id: projectId },
            ],
            async onQueryStarted(
                { taskId, projectId, body },
                { dispatch, queryFulfilled },
            ) {
                const patchProjectTasks = dispatch(
                    taskApi.util.updateQueryData(
                        'getTasksForProject',
                        projectId,
                        (draft) => {
                            const task = draft.find(
                                (item) => item.id === taskId,
                            )
                            if (!task) return

                            applyTaskUpdate(task, body)
                        },
                    ),
                )
                const patchTask = dispatch(
                    taskApi.util.updateQueryData(
                        'getTask',
                        taskId,
                        (draft) => {
                            applyTaskUpdate(draft, body)
                        },
                    ),
                )

                try {
                    await queryFulfilled
                } catch {
                    patchProjectTasks.undo()
                    patchTask.undo()
                }
            },
        }),

        deleteTask: builder.mutation<void, { taskId: string; projectId: string }>({
            query: ({ taskId }) => ({
                url: `/tasks/task/${taskId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Task' as const, id: projectId },
            ],
        }),

        assignTask: builder.mutation<TaskAssignee, { taskId: string; projectId: string; body: AssignTaskRequest }>({
            query: ({ taskId, body }) => ({
                url: `/tasks/task/${taskId}/assign`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Task' as const, id: projectId },
            ],
        }),

        unassignTask: builder.mutation<void, { taskId: string; projectId: string; body: UnassignTaskRequest }>({
            query: ({ taskId, body }) => ({
                url: `/tasks/task/${taskId}/unassign`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Task' as const, id: projectId },
            ],
        }),

        moveTask: builder.mutation<Task[], { taskId: string; projectId: string; body: MoveTaskRequest }>({
            query: ({ taskId, body }) => ({
                url: `/tasks/task/${taskId}/move`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: ApiTask[]) =>
                response.map(transformTask),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Task' as const, id: projectId },
            ],
            async onQueryStarted(
                { taskId, projectId, body },
                { dispatch, queryFulfilled },
            ) {
                const patchProjectTasks = dispatch(
                    taskApi.util.updateQueryData(
                        'getTasksForProject',
                        projectId,
                        (draft) => {
                            applyTaskMove(draft, taskId, body.position)
                        },
                    ),
                )
                const patchTask = dispatch(
                    taskApi.util.updateQueryData(
                        'getTask',
                        taskId,
                        (draft) => {
                            draft.position = body.position
                        },
                    ),
                )

                try {
                    await queryFulfilled
                } catch {
                    patchProjectTasks.undo()
                    patchTask.undo()
                }
            },
        }),
    }),
})

export const {
    useGetTasksForProjectQuery,
    useGetTaskQuery,
    useCreateTaskMutation,
    useUpdateTaskMutation,
    useDeleteTaskMutation,
    useAssignTaskMutation,
    useUnassignTaskMutation,
    useMoveTaskMutation,
} = taskApi
