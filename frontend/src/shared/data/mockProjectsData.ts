export interface ProjectMember {
    id: string
    name: string
    role: 'owner' | 'member'
}

export type ProjectSidebarIcon = 'megaphone' | 'smartphone' | 'users' | 'wrench'

export const AVAILABLE_PROJECT_SKILLS = [
    'React',
    'TypeScript',
    'Design',
    'Vue',
    'Node.js',
    'Python',
    'Figma',
]

export interface Project {
    id: string
    initials: string
    name: string
    description: string
    skills: string[]
    ownerId: string
    members: ProjectMember[]
    sidebarIcon: ProjectSidebarIcon
}

export const PROJECTS: Project[] = [
    {
        id: '1',
        initials: 'MK',
        name: 'Marketing Campaign Q2',
        description:
            'Planning and execution of Q2 marketing initiatives across all channels.',
        skills: ['React', 'Node.js', 'UX Design'],
        ownerId: 'u1',
        sidebarIcon: 'megaphone',
        members: [
            { id: 'u1', name: 'John Doe', role: 'owner' },
            { id: 'u2', name: 'Jane Smith', role: 'member' },
            { id: 'u3', name: 'Mike Brown', role: 'member' },
            { id: 'u4', name: 'Sarah Lee', role: 'member' },
            { id: 'u5', name: 'Chris Evans', role: 'member' },
            { id: 'u6', name: 'Nina Patel', role: 'member' },
        ],
    },
    {
        id: '2',
        initials: 'MPR',
        name: 'Mobile App Redesign',
        description:
            'Complete redesign of the mobile app experience with focus on user engagement.',
        skills: ['Figma', 'React Native', 'Design Systems'],
        ownerId: 'u2',
        sidebarIcon: 'smartphone',
        members: [
            { id: 'u2', name: 'Jane Smith', role: 'owner' },
            { id: 'u7', name: 'Alex Johnson', role: 'member' },
            { id: 'u8', name: 'Emily Chen', role: 'member' },
            { id: 'u9', name: 'Daniel Park', role: 'member' },
        ],
    },
    {
        id: '3',
        initials: 'CR',
        name: 'Customer Research',
        description:
            'Conduct user interviews, surveys, and synthesis to guide roadmap decisions.',
        skills: ['Research', 'User Interviews', 'Data Analysis'],
        ownerId: 'u3',
        sidebarIcon: 'users',
        members: [
            { id: 'u3', name: 'Mike Brown', role: 'owner' },
            { id: 'u10', name: 'Sophia Turner', role: 'member' },
            { id: 'u11', name: 'Liam Wilson', role: 'member' },
            { id: 'u12', name: 'Olivia Martin', role: 'member' },
            { id: 'u13', name: 'Noah Davis', role: 'member' },
        ],
    },
    {
        id: '4',
        initials: 'IT',
        name: 'Internal Tools',
        description:
            'Build internal tools to improve workflows, visibility, and team efficiency.',
        skills: ['TypeScript', 'Node.js', 'Automation'],
        ownerId: 'u4',
        sidebarIcon: 'wrench',
        members: [
            { id: 'u4', name: 'Sarah Lee', role: 'owner' },
            { id: 'u14', name: 'Ethan Walker', role: 'member' },
            { id: 'u15', name: 'Grace Hall', role: 'member' },
        ],
    },
]
