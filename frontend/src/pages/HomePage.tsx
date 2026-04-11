import { MainPageLayout } from '../components/main/MainPageLayout'
import { MainPageCard } from '../components/main/MainPageCard'
import { MainPageHeader } from '../components/main/MainPageHeader'
import { useNavigate } from 'react-router'

interface Project {
    id: string
    initials: string
    name: string
    description: string
    members: number
}

const PROJECTS: Project[] = [
    {
        id: 'mk',
        initials: 'MK',
        name: 'Marketing Campaign Q2',
        description:
            'Planning and execution of Q2 marketing initiatives across all channels',
        members: 6,
    },
    {
        id: 'mpr',
        initials: 'MPR',
        name: 'Mobile App Redesign',
        description:
            'Complete redesign of the mobile app experience with focus on user engagement',
        members: 1,
    },
    {
        id: 'cr',
        initials: 'CR',
        name: 'Customer Research',
        description: 'Conduct user interviews and surveys',
        members: 12,
    },
    {
        id: 'it',
        initials: 'IT',
        name: 'Internal Tools',
        description: 'Build tools to improve team efficiency',
        members: 2,
    },
]

export function HomePage() {
    const navigate = useNavigate()

    return (
        <MainPageLayout>
            <div className="flex-1 overflow-y-auto px-8 py-8">
                <MainPageHeader
                    title="Projects"
                    description="Manage your projects, collaborate with your team, and organize your workspaces."
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {PROJECTS.map((project) => (
                        <MainPageCard
                            key={project.id}
                            project={project}
                            onClick={() => navigate(`/project/${project.id}`)}
                        />
                    ))}
                </div>
            </div>
        </MainPageLayout>
    )
}
