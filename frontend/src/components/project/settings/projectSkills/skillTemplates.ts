export type SkillTemplate = {
    name: string
    description: string
}

export type SkillTemplateGroup = {
    id: string
    label: string
    description: string
    skills: SkillTemplate[]
}

export const skillTemplateGroups: SkillTemplateGroup[] = [
    {
        id: 'marketing',
        label: 'Marketing',
        description: 'Brand, content, and growth essentials',
        skills: [
            {
                name: 'Content Strategy',
                description: 'Plan and structure content across channels.',
            },
            {
                name: 'SEO',
                description: 'Optimize content for search visibility.',
            },
            {
                name: 'Copywriting',
                description: 'Write clear and compelling marketing copy.',
            },
            {
                name: 'Social Media',
                description: 'Manage and grow social channels.',
            },
            {
                name: 'Paid Ads',
                description: 'Run and optimize paid acquisition.',
            },
        ],
    },
    {
        id: 'design',
        label: 'Design',
        description: 'Research, UX, and interface design',
        skills: [
            {
                name: 'UX Research',
                description: 'Understand users through interviews and testing.',
            },
            {
                name: 'Wireframing',
                description: 'Sketch product structure and interaction flows.',
            },
            {
                name: 'UI Design',
                description: 'Design polished screens and reusable components.',
            },
            {
                name: 'Design Systems',
                description: 'Maintain consistent product patterns.',
            },
        ],
    },
    {
        id: 'engineering',
        label: 'Engineering',
        description: 'Frontend, backend, and delivery skills',
        skills: [
            {
                name: 'React',
                description:
                    'Build frontend components with hooks and modern patterns.',
            },
            {
                name: 'TypeScript',
                description: 'Use type-safe JavaScript for scalable codebases.',
            },
            {
                name: 'API Design',
                description:
                    'Design clear contracts between services and clients.',
            },
            {
                name: 'Testing',
                description:
                    'Cover critical behavior with reliable automated tests.',
            },
        ],
    },
    {
        id: 'product',
        label: 'Product',
        description: 'Discovery, planning, and product execution',
        skills: [
            {
                name: 'Roadmapping',
                description: 'Plan product direction and delivery milestones.',
            },
            {
                name: 'User Stories',
                description: 'Break product needs into actionable work.',
            },
            {
                name: 'Analytics',
                description: 'Use product data to guide decisions.',
            },
            {
                name: 'Stakeholder Management',
                description: 'Align people around product priorities.',
            },
        ],
    },
]
