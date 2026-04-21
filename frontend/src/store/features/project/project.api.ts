import { baseApi } from '../../api/base.api'
import type {
    ApiProject,
    CreateProjectRequest,
    CreateProjectSkillRequest,
    Project,
} from './project.types'

const getProjectInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)

    if (parts.length === 0) {
        return 'PR'
    }

    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

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
    initials: getProjectInitials(Name),
    members: Members ?? [],
    skills: Skills ?? [],
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
        addProjectSkill: builder.mutation<
            void,
            { projectId: string; body: CreateProjectSkillRequest }
        >({
            query: ({ projectId, body }) => ({
                url: `/projects/${projectId}/skills`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Project', id: projectId },
                { type: 'Project', id: 'LIST' },
            ],
        }),
    }),
})

export const {
    useGetProjectsQuery,
    useGetProjectByIdQuery,
    useCreateProjectMutation,
    useAddProjectSkillMutation,
} = projectApi
