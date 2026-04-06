import { ProjectHeader, SpacesContent } from '../../components/project'

const mockProject = {
    id: '1',
    name: 'Marketing Campaign Q2',
    description: 'Plan and execute Q2 marketing initiatives across channels.',
    skills: ['React', 'Node.js', 'UX Design'],
    ownerId: 'u1',
    members: [
        {
            id: 'u1',
            name: 'John Doe',
            role: 'owner',
        },
        {
            id: 'u2',
            name: 'Jane Smith',
            role: 'member',
        },
        {
            id: 'u3',
            name: 'Mike Brown',
            role: 'member',
        },
    ],
}

export function ProjectPage() {
    return (
        <div className="flex flex-col gap-8 p-6">
            <ProjectHeader name={mockProject.name} />
            <SpacesContent />
        </div>
    )
}
