import { useNavigate } from 'react-router'
import { MainPageLayout } from '../components/main/MainPageLayout'
import { MainPageCard } from '../components/main/MainPageCard'
import { MainPageHeader } from '../components/main/MainPageHeader'
import { EmptyProjectsState } from '../components/main/EmptyProjectsState'
import { PROJECTS } from '../shared/data/mockProjectsData'

export function HomePage() {
    const navigate = useNavigate()
    const hasProjects = PROJECTS.length > 0

    const handleCreateProject = () => {
        console.log('Create project')
    }

    return (
        <MainPageLayout>
            <div className="flex-1 overflow-y-auto px-8 py-8">
                <MainPageHeader
                    title="Projects"
                    description="Manage your projects, collaborate with your team, and organize your workspaces."
                    onCreateProject={handleCreateProject}
                />

                {hasProjects ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {PROJECTS.map((project) => (
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
