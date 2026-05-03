import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ProjectOverviewHeader, ProjectSpacesGrid } from '../components/project'
import { useGetProjectByIdQuery } from '../store/features/project/project.api'
import { ProjectPageSkeleton } from './ProjectPageSkeleton'

export function ProjectPage() {
    const { projectId } = useParams()
    const { t } = useTranslation('project')

    const { data: project, isLoading } = useGetProjectByIdQuery(
        projectId ?? '',
        {
            skip: !projectId,
        },
    )

    if (isLoading) {
        return <ProjectPageSkeleton />
    }

    if (!project) {
        return <div className="p-6">{t('projectPage.notFound')}</div>
    }

    return (
        <div className="flex flex-col gap-8 p-6">
            <ProjectOverviewHeader project={project} />
            <ProjectSpacesGrid />
        </div>
    )
}
