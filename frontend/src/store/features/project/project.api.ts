import { baseApi } from '../../api/base.api'
import { mapApiUserToUser } from '../user/user.api'
import type {
    ApiProject,
    ApiProjectMember,
    ApiProjectSkill,
    CreateProjectRequest,
    Project,
    ProjectMember,
    ProjectSkill,
    AddProjectMemberRequest,
    CreateProjectSkillRequest,
    UpdateProjectRequest,
} from './project.types'

const mapApiMemberToMember = ({
    ID,
    UserID,
    ProjectID,
    Role,
    JoinedAt,
    User,
}: ApiProjectMember): ProjectMember => ({
    id: ID,
    userId: UserID,
    projectId: ProjectID,
    role: Role,
    joinedAt: JoinedAt,
    user: mapApiUserToUser({
        ID: User.ID,
        Username: User.Username,
        Email: User.Email,
        FullName: User.FullName,
        AvatarURL: User.AvatarURL,
        CreatedAt: User.CreatedAt,
        UpdatedAt: User.UpdatedAt,
    }),
})

const mapApiSkillToSkill = ({
    ID,
    ProjectID,
    Name,
    Description,
}: ApiProjectSkill): ProjectSkill => ({
    id: ID,
    projectId: ProjectID,
    name: Name,
    description: Description,
})

const mapApiProjectToProject = ({
    ID,
    CreatedBy,
    Name,
    Slug,
    Description,
    Status,
    CreatedAt,
    UpdatedAt,
    JoinLink,
    Members,
    Skills,
}: ApiProject): Project => ({
    id: ID,
    createdBy: CreatedBy,
    name: Name,
    slug: Slug,
    description: Description ?? '',
    status: Status,
    createdAt: CreatedAt,
    updatedAt: UpdatedAt,
    joinLink: JoinLink,
    members: Members?.map(mapApiMemberToMember) ?? [],
    skills: Skills?.map(mapApiSkillToSkill) ?? [],
})

export const projectApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getProjects: builder.query<Project[], void>({
            query: () => '/projects',
            transformResponse: (response: ApiProject[]) =>
                response.map(mapApiProjectToProject),
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
                mapApiProjectToProject(response),
            providesTags: (_result, _error, id) => [{ type: 'Project', id }],
        }),

        getProjectMembers: builder.query<ProjectMember[], string>({
            query: (projectId) => `/projects/${projectId}/members`,
            transformResponse: (response: ApiProjectMember[]) =>
                response.map(mapApiMemberToMember),
            providesTags: (_result, _error, projectId) => [
                { type: 'ProjectMember' as const, id: projectId },
            ],
        }),

        createProject: builder.mutation<Project, CreateProjectRequest>({
            query: (body) => ({
                url: '/projects',
                method: 'POST',
                body: {
                    ...body,
                    description: body.description || null,
                },
            }),
            transformResponse: (response: ApiProject) =>
                mapApiProjectToProject(response),
            invalidatesTags: [{ type: 'Project', id: 'LIST' }],
        }),

        addProjectMember: builder.mutation<
            ProjectMember,
            { projectId: string; body: AddProjectMemberRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/members`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: ApiProjectMember) =>
                mapApiMemberToMember(response),
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
                mapApiSkillToSkill(response),
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
                mapApiProjectToProject(response),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Project' as const, id: projectId },
            ],
        }),
        getProjectSkills: builder.query<ProjectSkill[], string>({
            query: (projectId) => `/projects/${projectId}/skills`,
            transformResponse: (response: ApiProjectSkill[]) =>
                response.map(mapApiSkillToSkill),
            providesTags: (_result, _error, projectId) => [
                { type: 'ProjectSkill' as const, id: projectId },
            ],
        }),
        removeProjectSkill: builder.mutation<
            void,
            { projectId: string; skillId: string }
        >({
            query: ({ projectId, skillId }) => ({
                url: `/projects/${projectId}/skills/${skillId}`,
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
    useAddProjectMemberMutation,
    useAddProjectSkillMutation,
    useUpdateProjectMutation,
    useGetProjectSkillsQuery,
    useRemoveProjectSkillMutation,
    useRemoveProjectMemberMutation,
    useDeleteProjectMutation,
} = projectApi
