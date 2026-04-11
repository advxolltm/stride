import { useParams } from 'react-router'
import { ProjectOverviewHeader, ProjectSpacesGrid } from '../components/project'
import { PROJECTS } from '../shared/data/mockProjectsData'

export function ProjectPage() {
    const { projectId } = useParams()
    const project = PROJECTS.find((item) => item.id === projectId)

    if (!project) {
        return <div className="p-6">Project not found.</div>
    }

    return (
        <div className="flex flex-col gap-8 p-6">
            <ProjectOverviewHeader name={project.name} />
            <ProjectSpacesGrid />
        </div>
    )
}
