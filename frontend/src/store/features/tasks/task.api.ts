import { baseApi } from '../../api/base.api'
import { projectApi } from '../project/project.api'
import {
    applyTaskAssignee,
    applyTaskMove,
    applyTaskSkill,
    applyTaskUpdate,
    patchTaskFields,
    patchTask,
    removeTaskAssignee,
    removeTaskSkill,
} from './task.cache'
import {
    mapApiTaskAssigneeToAssignee,
    mapProjectMemberToTaskAssignee,
    mapProjectSkillToTaskSkill,
    transformTask,
} from './task.mappers'
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
            async onQueryStarted(
                { taskId, projectId, body },
                { dispatch, queryFulfilled },
            ) {
                // Show the edit right away in both the board and the task detail cache.
                // Once the request finishes, we overwrite these fields with the server result.
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
                const patchTaskDetail = dispatch(
                    taskApi.util.updateQueryData('getTask', taskId, (draft) => {
                        applyTaskUpdate(draft, body)
                    }),
                )

                try {
                    const { data } = await queryFulfilled
                    // Instead of refetching the whole task list, we update just the changed task
                    // directly in the cache. We locate it by ID and patch it with the latest data
                    // from the server so the UI updates instantly.
                    dispatch(
                        taskApi.util.updateQueryData(
                            'getTasksForProject',
                            projectId,
                            (draft) => {
                                const task = draft.find(
                                    (item) => item.id === taskId,
                                )
                                if (task) {
                                    patchTaskFields(task, data)
                                }
                            },
                        ),
                    )
                    dispatch(
                        taskApi.util.updateQueryData(
                            'getTask',
                            taskId,
                            (draft) => {
                                patchTaskFields(draft, data)
                            },
                        ),
                    )
                } catch {
                    patchProjectTasks.undo()
                    patchTaskDetail.undo()
                }
            },
        }),
        deleteTask: builder.mutation<
            void,
            { taskId: string; projectId: string }
        >({
            query: ({ taskId }) => ({
                url: `/tasks/task/${taskId}`,
                method: 'DELETE',
            }),
            async onQueryStarted(
                { taskId, projectId },
                { dispatch, queryFulfilled },
            ) {
                // Deleting a task does not reorder the rest, so removing it locally is enough.
                // If the request fails, RTK Query gives us an undo function.
                const patchProjectTasks = dispatch(
                    taskApi.util.updateQueryData(
                        'getTasksForProject',
                        projectId,
                        (draft) => draft.filter((task) => task.id !== taskId),
                    ),
                )

                try {
                    await queryFulfilled
                } catch {
                    patchProjectTasks.undo()
                }
            },
        }),
        assignTask: builder.mutation<
            TaskAssignee,
            { taskId: string; projectId: string; body: AssignTaskRequest }
        >({
            query: ({ taskId, body }) => ({
                url: `/tasks/task/${taskId}/assign`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: ApiTaskAssignee) =>
                mapApiTaskAssigneeToAssignee(response),
            async onQueryStarted(
                { taskId, projectId, body },
                { dispatch, getState, queryFulfilled },
            ) {
                // FIXME: The backend currently returns project_member with empty user data.
                // Use cached project members for display until that response is fixed.
                const project =
                    projectApi.endpoints.getProjectById.select(projectId)(
                        getState(),
                    ).data
                const member = project?.members.find(
                    (item) => item.id === body.project_member_id,
                )

                if (!member) {
                    try {
                        await queryFulfilled
                        dispatch(
                            baseApi.util.invalidateTags([
                                { type: 'Task' as const, id: projectId },
                            ]),
                        )
                    } catch {
                        // The hook that called this mutation will surface the error.
                    }
                    return
                }

                const optimisticAssignee = mapProjectMemberToTaskAssignee(
                    member,
                    taskId,
                    `optimistic-${taskId}-${member.id}`,
                )
                const patchProjectTasks = dispatch(
                    taskApi.util.updateQueryData(
                        'getTasksForProject',
                        projectId,
                        (draft) => {
                            const task = draft.find(
                                (item) => item.id === taskId,
                            )
                            if (task)
                                applyTaskAssignee(task, optimisticAssignee)
                        },
                    ),
                )
                const patchTaskDetail = dispatch(
                    taskApi.util.updateQueryData('getTask', taskId, (draft) => {
                        applyTaskAssignee(draft, optimisticAssignee)
                    }),
                )

                try {
                    const { data } = await queryFulfilled
                    const confirmedAssignee = {
                        ...optimisticAssignee,
                        id: data.id,
                        assignedAt: data.assignedAt,
                    }
                    dispatch(
                        taskApi.util.updateQueryData(
                            'getTasksForProject',
                            projectId,
                            (draft) => {
                                const task = draft.find(
                                    (item) => item.id === taskId,
                                )
                                if (task) {
                                    applyTaskAssignee(task, confirmedAssignee)
                                }
                            },
                        ),
                    )
                    dispatch(
                        taskApi.util.updateQueryData(
                            'getTask',
                            taskId,
                            (draft) => {
                                applyTaskAssignee(draft, confirmedAssignee)
                            },
                        ),
                    )
                } catch {
                    patchProjectTasks.undo()
                    patchTaskDetail.undo()
                }
            },
        }),

        unassignTask: builder.mutation<
            void,
            { taskId: string; projectId: string; body: UnassignTaskRequest }
        >({
            query: ({ taskId, body }) => ({
                url: `/tasks/task/${taskId}/unassign`,
                method: 'POST',
                body,
            }),
            async onQueryStarted(
                { taskId, projectId, body },
                { dispatch, queryFulfilled },
            ) {
                // Remove the assignee from the board and detail cache right away.
                // If the request fails, we undo the local change.
                const patchProjectTasks = dispatch(
                    taskApi.util.updateQueryData(
                        'getTasksForProject',
                        projectId,
                        (draft) => {
                            const task = draft.find(
                                (item) => item.id === taskId,
                            )
                            if (task) {
                                removeTaskAssignee(task, body.project_member_id)
                            }
                        },
                    ),
                )
                const patchTaskDetail = dispatch(
                    taskApi.util.updateQueryData('getTask', taskId, (draft) => {
                        removeTaskAssignee(draft, body.project_member_id)
                    }),
                )

                try {
                    await queryFulfilled
                } catch {
                    patchProjectTasks.undo()
                    patchTaskDetail.undo()
                }
            },
        }),
        moveTask: builder.mutation<
            Task,
            { taskId: string; projectId: string; body: MoveTaskRequest }
        >({
            query: ({ taskId, body }) => ({
                url: `/tasks/task/${taskId}/move`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: ApiTask) => transformTask(response),
            async onQueryStarted(
                { taskId, projectId, body },
                { dispatch, queryFulfilled },
            ) {
                // Backend returns moved task only. Reorder board optimistically, then
                // patch the moved task with server-confirmed fields.
                const patchProjectTasks = dispatch(
                    taskApi.util.updateQueryData(
                        'getTasksForProject',
                        projectId,
                        (draft) => {
                            applyTaskMove(draft, taskId, body.position)
                        },
                    ),
                )
                const patchTaskDetail = dispatch(
                    taskApi.util.updateQueryData('getTask', taskId, (draft) => {
                        draft.position = body.position
                    }),
                )

                try {
                    const { data } = await queryFulfilled
                    dispatch(
                        taskApi.util.updateQueryData(
                            'getTasksForProject',
                            projectId,
                            (draft) => {
                                const task = draft.find(
                                    (item) => item.id === taskId,
                                )
                                if (task) {
                                    patchTask(task, data)
                                }
                            },
                        ),
                    )
                    dispatch(
                        taskApi.util.updateQueryData(
                            'getTask',
                            taskId,
                            (draft) => {
                                patchTask(draft, data)
                            },
                        ),
                    )
                } catch {
                    patchProjectTasks.undo()
                    patchTaskDetail.undo()
                }
            },
        }),
        addSkillToTask: builder.mutation<
            void,
            { taskId: string; projectId: string; skillId: string }
        >({
            query: ({ taskId, skillId }) => ({
                url: `/tasks/task/${taskId}/add-skill`,
                method: 'POST',
                body: { skillId },
            }),
            async onQueryStarted(
                { taskId, projectId, skillId },
                { dispatch, getState, queryFulfilled },
            ) {
                // This endpoint returns no body. We can still show the skill immediately
                // because the project skill data is already in cache.
                const project =
                    projectApi.endpoints.getProjectById.select(projectId)(
                        getState(),
                    ).data
                const skill = project?.skills.find(
                    (item) => item.id === skillId,
                )

                if (!skill) {
                    try {
                        await queryFulfilled
                        dispatch(
                            baseApi.util.invalidateTags([
                                { type: 'Task' as const, id: projectId },
                            ]),
                        )
                    } catch {
                        // The hook that called this mutation will surface the error.
                    }
                    return
                }

                const optimisticSkill = mapProjectSkillToTaskSkill(
                    skill,
                    taskId,
                    `optimistic-${taskId}-${skill.id}`,
                )
                const patchProjectTasks = dispatch(
                    taskApi.util.updateQueryData(
                        'getTasksForProject',
                        projectId,
                        (draft) => {
                            const task = draft.find(
                                (item) => item.id === taskId,
                            )
                            if (task) applyTaskSkill(task, optimisticSkill)
                        },
                    ),
                )
                const patchTaskDetail = dispatch(
                    taskApi.util.updateQueryData('getTask', taskId, (draft) => {
                        applyTaskSkill(draft, optimisticSkill)
                    }),
                )

                try {
                    await queryFulfilled
                } catch {
                    patchProjectTasks.undo()
                    patchTaskDetail.undo()
                }
            },
        }),

        removeSkillFromTask: builder.mutation<
            void,
            { taskId: string; projectId: string; skillId: string }
        >({
            query: ({ taskId, skillId }) => ({
                url: `/tasks/task/${taskId}/remove-skill`,
                method: 'POST',
                body: { skillId },
            }),
            async onQueryStarted(
                { taskId, projectId, skillId },
                { dispatch, queryFulfilled },
            ) {
                // Removing a skill only changes this task's skill list, so no full task
                // refetch is needed.
                const patchProjectTasks = dispatch(
                    taskApi.util.updateQueryData(
                        'getTasksForProject',
                        projectId,
                        (draft) => {
                            const task = draft.find(
                                (item) => item.id === taskId,
                            )
                            if (task) removeTaskSkill(task, skillId)
                        },
                    ),
                )
                const patchTaskDetail = dispatch(
                    taskApi.util.updateQueryData('getTask', taskId, (draft) => {
                        removeTaskSkill(draft, skillId)
                    }),
                )

                try {
                    await queryFulfilled
                } catch {
                    patchProjectTasks.undo()
                    patchTaskDetail.undo()
                }
            },
        }),
    }),
})

export const {
    useGetTasksForProjectQuery,
    useGetTaskQuery,
    useLazyGetTaskQuery,
    useCreateTaskMutation,
    useUpdateTaskMutation,
    useDeleteTaskMutation,
    useAssignTaskMutation,
    useUnassignTaskMutation,
    useMoveTaskMutation,
    useAddSkillToTaskMutation,
    useRemoveSkillFromTaskMutation,
} = taskApi
