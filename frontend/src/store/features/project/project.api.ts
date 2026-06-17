import { baseApi } from '../../api/base.api'
import {
    applyProjectMembers,
    applyProjectSkill,
    applyProjectUpdate,
    patchProject,
    patchProjectFields,
    removeProjectMemberByUserId,
    removeProjectSkillById,
} from './project.cache'
import {
    ApiProjectListSchema,
    ApiProjectMemberListSchema,
    ApiSchedulerAssignmentListSchema,
    ApiSchedulerPreviewResponseSchema,
    ApiProjectSchema,
    ApiProjectSkillListSchema,
    ApiProjectSkillSchema,
    type AddProjectMembersRequest,
    type CreateProjectRequest,
    type CreateProjectSkillRequest,
    type Project,
    type ProjectMember,
    type ProjectSkill,
    type SchedulerConfirmRequest,
    type SchedulerPreviewResponse,
    type SchedulerScheduleRequest,
    type UpdateProjectRequest,
} from './project.types'
import {
    transformProject,
    transformProjectMember,
    transformProjectSkill,
    transformSchedulerAssignment,
    transformSchedulerPreviewResponse,
} from './project.mappers'

export const projectApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getProjects: builder.query<Project[], void>({
            query: () => '/projects',
            transformResponse: (response: unknown) =>
                ApiProjectListSchema.parse(response).map(transformProject),
            providesTags: (result) =>
                result
                    ? [
                          { type: 'Project', id: 'LIST' },
                          ...result.map((project) => ({
                              type: 'Project' as const,
                              id: project.id,
                          })),
                      ]
                    : [{ type: 'Project', id: 'LIST' }],
        }),

        getProjectById: builder.query<Project, string>({
            query: (id) => `/projects/${id}`,
            transformResponse: (response: unknown) =>
                transformProject(ApiProjectSchema.parse(response)),
            providesTags: (_result, _error, id) => [{ type: 'Project', id }],
        }),

        getProjectMembers: builder.query<ProjectMember[], string>({
            query: (projectId) => `/projects/${projectId}/members`,
            transformResponse: (response: unknown) =>
                ApiProjectMemberListSchema.parse(response).map(
                    transformProjectMember,
                ),
            providesTags: (_result, _error, projectId) => [
                { type: 'ProjectMember' as const, id: projectId },
            ],
        }),

        scheduleProjectTasks: builder.mutation<
            SchedulerPreviewResponse,
            { projectId: string; body: SchedulerScheduleRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/scheduler`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: unknown) =>
                transformSchedulerPreviewResponse(
                    ApiSchedulerPreviewResponseSchema.parse(response),
                ),
        }),

        confirmScheduledAssignments: builder.mutation<
            import('./project.types').SchedulerAssignment[],
            { projectId: string; body: SchedulerConfirmRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/scheduler/confirm`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: unknown) =>
                ApiSchedulerAssignmentListSchema.parse(response).map(
                    transformSchedulerAssignment,
                ),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Task' as const, id: projectId },
            ],
        }),

        createProject: builder.mutation<Project, CreateProjectRequest>({
            query: (body) => ({
                url: '/projects',
                method: 'POST',
                body: { ...body, description: body.description || null },
            }),
            transformResponse: (response: unknown) =>
                transformProject(ApiProjectSchema.parse(response)),
            async onQueryStarted(_body, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled
                    // The create response is a full project, so we can place it in the
                    // project list and seed the detail cache without refetching all projects.
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjects',
                            undefined,
                            (draft) => {
                                if (
                                    !draft.some((item) => item.id === data.id)
                                ) {
                                    draft.push(data)
                                }
                            },
                        ),
                    )
                    dispatch(
                        projectApi.util.upsertQueryData(
                            'getProjectById',
                            data.id,
                            data,
                        ),
                    )
                } catch {
                    // The hook that called this mutation will surface the error.
                }
            },
        }),

        addProjectMembers: builder.mutation<
            ProjectMember[],
            { projectId: string; body: AddProjectMembersRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/members`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: unknown) =>
                ApiProjectMemberListSchema.parse(response).map(
                    transformProjectMember,
                ),
            async onQueryStarted({ projectId }, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled
                    // Adding members affects the members query and the embedded members
                    // shown on project detail/list cards, so keep those caches in sync.
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjectMembers',
                            projectId,
                            (draft) => {
                                for (const member of data) {
                                    const existingIndex = draft.findIndex(
                                        (item) =>
                                            item.id === member.id ||
                                            item.userId === member.userId,
                                    )

                                    if (existingIndex === -1) {
                                        draft.push(member)
                                    } else {
                                        draft[existingIndex] = member
                                    }
                                }
                            },
                        ),
                    )
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjectById',
                            projectId,
                            (draft) => {
                                applyProjectMembers(draft, data)
                            },
                        ),
                    )
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjects',
                            undefined,
                            (draft) => {
                                const project = draft.find(
                                    (item) => item.id === projectId,
                                )
                                if (project) applyProjectMembers(project, data)
                            },
                        ),
                    )
                } catch {
                    // The hook that called this mutation will surface the error.
                }
            },
        }),

        addProjectSkill: builder.mutation<
            ProjectSkill,
            { projectId: string; body: CreateProjectSkillRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/skills`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: unknown) =>
                transformProjectSkill(ApiProjectSkillSchema.parse(response)),
            async onQueryStarted({ projectId }, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled
                    // The backend returns the new skill, which is enough to update every
                    // project cache that displays the skill list.
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjectSkills',
                            projectId,
                            (draft) => {
                                if (
                                    !draft.some((item) => item.id === data.id)
                                ) {
                                    draft.push(data)
                                }
                            },
                        ),
                    )
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjectById',
                            projectId,
                            (draft) => {
                                applyProjectSkill(draft, data)
                            },
                        ),
                    )
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjects',
                            undefined,
                            (draft) => {
                                const project = draft.find(
                                    (item) => item.id === projectId,
                                )
                                if (project) applyProjectSkill(project, data)
                            },
                        ),
                    )
                } catch {
                    // The hook that called this mutation will surface the error.
                }
            },
        }),

        updateProject: builder.mutation<
            Project,
            { projectId: string; body: UpdateProjectRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (response: unknown) =>
                transformProject(ApiProjectSchema.parse(response)),
            async onQueryStarted(
                { projectId, body },
                { dispatch, queryFulfilled },
            ) {
                // Show the edited project fields immediately, then replace them with
                // the server-confirmed values once the request finishes.
                const patchProjectList = dispatch(
                    projectApi.util.updateQueryData(
                        'getProjects',
                        undefined,
                        (draft) => {
                            const project = draft.find(
                                (item) => item.id === projectId,
                            )
                            if (project) applyProjectUpdate(project, body)
                        },
                    ),
                )
                const patchProjectDetail = dispatch(
                    projectApi.util.updateQueryData(
                        'getProjectById',
                        projectId,
                        (draft) => {
                            applyProjectUpdate(draft, body)
                        },
                    ),
                )

                try {
                    const { data } = await queryFulfilled
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjects',
                            undefined,
                            (draft) => {
                                const project = draft.find(
                                    (item) => item.id === projectId,
                                )
                                if (project) patchProjectFields(project, data)
                            },
                        ),
                    )
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getProjectById',
                            projectId,
                            (draft) => {
                                patchProject(draft, data)
                            },
                        ),
                    )
                } catch {
                    patchProjectList.undo()
                    patchProjectDetail.undo()
                }
            },
        }),

        getProjectSkills: builder.query<ProjectSkill[], string>({
            query: (projectId) => `/projects/${projectId}/skills`,
            transformResponse: (response: unknown) =>
                ApiProjectSkillListSchema.parse(response).map(
                    transformProjectSkill,
                ),
            providesTags: (_result, _error, projectId) => [
                { type: 'ProjectSkill' as const, id: projectId },
            ],
        }),

        removeProjectSkill: builder.mutation<
            void,
            { projectId: string; skillId: string }
        >({
            query: ({ skillId }) => ({
                url: `/projects/skills/${skillId}`,
                method: 'DELETE',
            }),
            async onQueryStarted(
                { projectId, skillId },
                { dispatch, queryFulfilled },
            ) {
                // Delete returns no body, but the skill id is enough to remove it from
                // all project caches. Undo puts it back if the request fails.
                const patchProjectSkills = dispatch(
                    projectApi.util.updateQueryData(
                        'getProjectSkills',
                        projectId,
                        (draft) =>
                            draft.filter((skill) => skill.id !== skillId),
                    ),
                )
                const patchProjectDetail = dispatch(
                    projectApi.util.updateQueryData(
                        'getProjectById',
                        projectId,
                        (draft) => {
                            removeProjectSkillById(draft, skillId)
                        },
                    ),
                )
                const patchProjectList = dispatch(
                    projectApi.util.updateQueryData(
                        'getProjects',
                        undefined,
                        (draft) => {
                            const project = draft.find(
                                (item) => item.id === projectId,
                            )
                            if (project)
                                removeProjectSkillById(project, skillId)
                        },
                    ),
                )

                try {
                    await queryFulfilled
                } catch {
                    patchProjectSkills.undo()
                    patchProjectDetail.undo()
                    patchProjectList.undo()
                }
            },
        }),

        removeProjectMember: builder.mutation<
            void,
            { projectId: string; memberId: string }
        >({
            query: ({ projectId, memberId }) => ({
                url: `/projects/${projectId}/members/${memberId}`,
                method: 'DELETE',
            }),
            async onQueryStarted(
                { projectId, memberId },
                { dispatch, queryFulfilled },
            ) {
                // The route removes by user id, so we remove the same user from the
                // standalone members query and the embedded project member lists.
                const patchProjectMembers = dispatch(
                    projectApi.util.updateQueryData(
                        'getProjectMembers',
                        projectId,
                        (draft) =>
                            draft.filter(
                                (member) => member.userId !== memberId,
                            ),
                    ),
                )
                const patchProjectDetail = dispatch(
                    projectApi.util.updateQueryData(
                        'getProjectById',
                        projectId,
                        (draft) => {
                            removeProjectMemberByUserId(draft, memberId)
                        },
                    ),
                )
                const patchProjectList = dispatch(
                    projectApi.util.updateQueryData(
                        'getProjects',
                        undefined,
                        (draft) => {
                            const project = draft.find(
                                (item) => item.id === projectId,
                            )
                            if (project)
                                removeProjectMemberByUserId(project, memberId)
                        },
                    ),
                )

                try {
                    await queryFulfilled
                } catch {
                    patchProjectMembers.undo()
                    patchProjectDetail.undo()
                    patchProjectList.undo()
                }
            },
        }),

        deleteProject: builder.mutation<void, string>({
            query: (projectId) => ({
                url: `/projects/${projectId}`,
                method: 'DELETE',
            }),
            async onQueryStarted(projectId, { dispatch, queryFulfilled }) {
                // A deleted project only needs to disappear from the project list here.
                // The UI should navigate away from any open detail view separately.
                const patchProjectList = dispatch(
                    projectApi.util.updateQueryData(
                        'getProjects',
                        undefined,
                        (draft) =>
                            draft.filter((project) => project.id !== projectId),
                    ),
                )

                try {
                    await queryFulfilled
                } catch {
                    patchProjectList.undo()
                }
            },
        }),
    }),
})

export const {
    useGetProjectsQuery,
    useGetProjectByIdQuery,
    useGetProjectMembersQuery,
    useScheduleProjectTasksMutation,
    useConfirmScheduledAssignmentsMutation,
    useCreateProjectMutation,
    useAddProjectMembersMutation,
    useAddProjectSkillMutation,
    useUpdateProjectMutation,
    useGetProjectSkillsQuery,
    useRemoveProjectSkillMutation,
    useRemoveProjectMemberMutation,
    useDeleteProjectMutation,
} = projectApi
