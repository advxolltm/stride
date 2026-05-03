import { Button, Surface, Tabs } from '@heroui/react'
import { FolderKanban, LayoutTemplate, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Project } from '../../../../store/features/project/project.types'
import { AddSkillForm } from './AddSkillForm'
import { ProjectSkillsPanel } from './ProjectSkillsPanel'
import { TemplateSkillsPanel } from './TemplateSkillsPanel'
import type { ProjectSkillInput } from './skillUtils'

type AddSkillTab = 'templates' | 'projects' | 'custom'

interface AddProjectSkillPanelProps {
    project: Project
    projects: Project[]
    addedSkillNames: Set<string>
    isCreatingProjectSkill: boolean
    addProjectSkill: (skill: ProjectSkillInput) => void
    addProjectSkills: (skills: ProjectSkillInput[]) => void
    onDone: () => void
}

export function AddProjectSkillPanel({
    project,
    projects,
    addedSkillNames,
    isCreatingProjectSkill,
    addProjectSkill,
    addProjectSkills,
    onDone,
}: Readonly<AddProjectSkillPanelProps>) {
    const { t } = useTranslation('project')
    const [activeTab, setActiveTab] = useState<AddSkillTab>('templates')

    return (
        <Surface
            variant="secondary"
            className="flex h-full min-h-0 flex-col gap-4 rounded-xl border p-4"
        >
            <Tabs
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(key as AddSkillTab)}
                className="flex min-h-0 flex-1 flex-col"
            >
                <Tabs.ListContainer className="shrink-0">
                    <Tabs.List
                        aria-label={t('skillsSettings.addSkillTabsLabel')}
                        className="flex flex-wrap"
                    >
                        <Tabs.Tab
                            className="min-w-fit flex-1 flex-row gap-2"
                            id="templates"
                        >
                            <LayoutTemplate size={14} />
                            {t('skillsSettings.addSkillTabs.templates')}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab
                            className="min-w-fit flex-1 flex-row gap-2"
                            id="projects"
                        >
                            <FolderKanban size={14} />
                            {t('skillsSettings.addSkillTabs.projects')}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab
                            className="min-w-fit flex-1 flex-row gap-2"
                            id="custom"
                        >
                            <Pencil size={14} />
                            {t('skillsSettings.addSkillTabs.custom')}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    </Tabs.List>
                </Tabs.ListContainer>

                <Tabs.Panel id="templates" className="min-h-0 flex-1">
                    <TemplateSkillsPanel
                        addedSkillNames={addedSkillNames}
                        isCreatingProjectSkill={isCreatingProjectSkill}
                        addProjectSkill={addProjectSkill}
                        addProjectSkills={addProjectSkills}
                    />
                </Tabs.Panel>

                <Tabs.Panel id="projects" className="min-h-0 flex-1">
                    <ProjectSkillsPanel
                        currentProjectId={project.id}
                        projects={projects}
                        addedSkillNames={addedSkillNames}
                        isCreatingProjectSkill={isCreatingProjectSkill}
                        addProjectSkill={addProjectSkill}
                        addProjectSkills={addProjectSkills}
                    />
                </Tabs.Panel>

                <Tabs.Panel
                    id="custom"
                    className="min-h-0 flex-1 overflow-y-auto pr-1"
                >
                    <AddSkillForm projectId={project.id} />
                </Tabs.Panel>
            </Tabs>

            <div className="flex shrink-0 justify-end">
                <Button variant="ghost" size="sm" onPress={onDone}>
                    {t('skillsSettings.done')}
                </Button>
            </div>
        </Surface>
    )
}
