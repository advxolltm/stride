import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectSkillsCard } from './ProjectSkillsCard'

const MOCK_PROJECTS = [
    {
        id: '1',
        name: 'Marketing Campaign Q2',
        skills: ['SEO', 'Analytics', 'Content Writing'],
        selected: ['SEO'],
    },
    {
        id: '2',
        name: 'Mobile App Redesign',
        skills: ['UI Design', 'React Native'],
        selected: ['UI Design'],
    },
]

export function SkillsSection() {
    const { t } = useTranslation('setting')

    const [projects, setProjects] = useState(MOCK_PROJECTS)

    const handleChange = (projectId: string, values: string[]) => {
        setProjects((prev) =>
            prev.map((p) =>
                p.id === projectId ? { ...p, selected: values } : p,
            ),
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="font-semibold">{t('skills.title')}</h2>
                <p className="text-muted-foreground text-sm">
                    {t('skills.description')}
                </p>
            </div>

            {projects.map((project) => (
                <ProjectSkillsCard
                    key={project.id}
                    project={project}
                    onChange={(values) => handleChange(project.id, values)}
                />
            ))}
        </div>
    )
}
