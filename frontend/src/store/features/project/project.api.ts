import { baseApi } from '../../api/base.api'
import type {
    AddProjectMembersRequest,
    ApiProject,
    ApiProjectMember,
    ApiProjectSkill,
    ApiProjectUser,
    CreateProjectRequest,
    CreateProjectSkillRequest,
    Project,
    ProjectMember,
    ProjectSkill,
    ProjectUser,
    UpdateProjectRequest,
} from './project.types'

// Transformation functions
const transformApiUser = (user: ApiProjectUser): ProjectUser => ({
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
})

// Transformation functions
const transformProjectSkill = (skill: ApiProjectSkill): ProjectSkill => ({
    id: skill.id,
    projectId: skill.project_id,
    name: skill.name,
    description: skill.description,
})

const transformProjectMember = (member: ApiProjectMember): ProjectMember => ({
    id: member.id,
    userId: member.user_id,
    projectId: member.project_id,
    role: member.role,
    joinedAt: member.joined_at,
    user: transformApiUser(member.user),
})

const transformProject = (project: ApiProject): Project => ({
    id: project.id,
    createdBy: project.created_by,
    name: project.name,
    slug: project.slug,
    description: project.description,
    status: project.status,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    joinLink: project.join_link,
    creator: transformApiUser(project.creator),
    members: project.members.map(transformProjectMember),
    skills: project.skills?.map(transformProjectSkill) ?? [],
})

export const projectApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getProjects: builder.query<Project[], void>({
            query: () => '/projects',
            transformResponse: (response: ApiProject[]) =>
                response.map(transformProject),
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
            transformResponse: (response: ApiProject) =>
                transformProject(response),
            providesTags: (_result, _error, id) => [{ type: 'Project', id }],
        }),

        getProjectMembers: builder.query<ProjectMember[], string>({
            query: (projectId) => `/projects/${projectId}/members`,
            transformResponse: (response: ApiProjectMember[]) =>
                response.map(transformProjectMember),
            providesTags: (_result, _error, projectId) => [
                { type: 'ProjectMember' as const, id: projectId },
            ],
        }),

        createProject: builder.mutation<Project, CreateProjectRequest>({
            query: (body) => ({
                url: '/projects',
                method: 'POST',
                body: { ...body, description: body.description || null },
            }),
            transformResponse: (response: ApiProject) =>
                transformProject(response),
            invalidatesTags: [{ type: 'Project', id: 'LIST' }],
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
            transformResponse: (response: ApiProjectMember[]) =>
                response.map(transformProjectMember),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'ProjectMember' as const, id: projectId },
                { type: 'Project' as const, id: projectId },
            ],
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
            transformResponse: (response: ApiProjectSkill) =>
                transformProjectSkill(response),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Project' as const, id: projectId },
                { type: 'Project' as const, id: 'LIST' },
                { type: 'ProjectSkill' as const, id: projectId },
            ],
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
            transformResponse: (response: ApiProject) =>
                transformProject(response),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Project' as const, id: projectId },
            ],
        }),

        getProjectSkills: builder.query<ProjectSkill[], string>({
            query: (projectId) => `/projects/${projectId}/skills`,
            transformResponse: (response: ApiProjectSkill[]) =>
                response.map(transformProjectSkill),
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
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'ProjectSkill' as const, id: projectId },
                { type: 'Project' as const, id: projectId },
            ],
        }),

        removeProjectMember: builder.mutation<
            void,
            { projectId: string; memberId: string }
        >({
            query: ({ projectId, memberId }) => ({
                url: `/projects/${projectId}/members/${memberId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'ProjectMember' as const, id: projectId },
                { type: 'Project' as const, id: projectId },
            ],
        }),

        deleteProject: builder.mutation<void, string>({
            query: (projectId) => ({
                url: `/projects/${projectId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, projectId) => [
                { type: 'Project', id: projectId },
                { type: 'Project', id: 'LIST' },
            ],
        }),
    }),
})

export const {
    useGetProjectsQuery,
    useGetProjectByIdQuery,
    useGetProjectMembersQuery,
    useCreateProjectMutation,
    useAddProjectMembersMutation,
    useAddProjectSkillMutation,
    useUpdateProjectMutation,
    useGetProjectSkillsQuery,
    useRemoveProjectSkillMutation,
    useRemoveProjectMemberMutation,
    useDeleteProjectMutation,
} = projectApi
