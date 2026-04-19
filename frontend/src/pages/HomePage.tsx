import { useNavigate } from 'react-router'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MainPageLayout } from '../components/main/MainPageLayout'
import { MainPageCard } from '../components/main/MainPageCard'
import { MainPageHeader } from '../components/main/MainPageHeader'
import { EmptyProjectsState } from '../components/main/EmptyProjectsState'
import type { AppLayoutOutletContext } from '../layouts/AppLayout'
import { useGetProjectsQuery } from '../store/features/project/project.api'

export function HomePage() {
    const navigate = useNavigate()
    const { t } = useTranslation('project')
    const { openCreateProjectDialog } =
        useOutletContext<AppLayoutOutletContext>()
    const { data: projects = [], isLoading } = useGetProjectsQuery()
    const hasProjects = projects.length > 0

    const handleCreateProject = () => {
        openCreateProjectDialog()
    }

    return (
        <MainPageLayout>
            <div className="flex-1 overflow-y-auto px-8 py-8">
                <MainPageHeader
                    title={t('home.title')}
                    description={t('home.description')}
                    onCreateProject={
                        hasProjects ? handleCreateProject : undefined
                    }
                />

                {isLoading ? (
                    <div className="py-10 text-sm text-[var(--muted)]">
                        Loading projects...
                    </div>
                ) : hasProjects ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {projects.map((project) => (
                            <MainPageCard
                                key={project.id}
                                project={{
                                    id: project.id,
                                    initials: project.initials,
                                    name: project.name,
                                    description: project.description,
                                    members: project.members.length,
                                }}
                                onClick={() =>
                                    navigate(`/project/${project.id}`)
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyProjectsState onCreateProject={handleCreateProject} />
                )}
            </div>
        </MainPageLayout>
    )
}
