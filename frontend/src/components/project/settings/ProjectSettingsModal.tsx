import { Modal } from '@heroui/react'
import { useState } from 'react'
import type { Project } from '../../../store/features/project/project.types'
import { ProjectGeneralSettings } from './ProjectGeneralSettings'
import { MyProjectSkillsSettings } from './mySkills/MyProjectSkillsSettings'
import { ProjectMembersSettings } from './projectMembers/ProjectMembersSettings'
import {
    ProjectSettingsSidebar,
    type ProjectSettingsTab,
} from './ProjectSettingsSidebar'
import { ProjectSkillsSettings } from './projectSkills/ProjectSkillsSettings'
import { MyProjectWorkingHoursSettings } from './workingHours/MyProjectWorkingHoursSettings'

interface ProjectSettingsModalProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    isOwner: boolean
    project: Project
}

export function ProjectSettingsModal({
    isOpen,
    isOwner,
    setIsOpen,
    project,
}: ProjectSettingsModalProps) {
    const [activeTab, setActiveTab] = useState<ProjectSettingsTab>('general')

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)

        if (!open) {
            setActiveTab('general')
        }
    }

    return (
        <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="cover">
                    <Modal.Dialog className="overflow-hidden px-2 py-4 sm:p-6 xl:pl-2">
                        <Modal.CloseTrigger />
                        <div className="flex h-full min-h-0 flex-col xl:flex-row">
                            <ProjectSettingsSidebar
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />

                            <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6 xl:p-8">
                                {activeTab === 'general' && (
                                    <ProjectGeneralSettings
                                        isOwner={isOwner}
                                        project={project}
                                    />
                                )}
                                {activeTab === 'members' && (
                                    <ProjectMembersSettings
                                        isOwner={isOwner}
                                        project={project}
                                    />
                                )}
                                {activeTab === 'skills' && (
                                    <ProjectSkillsSettings
                                        isOwner={isOwner}
                                        project={project}
                                    />
                                )}
                                {activeTab === 'my-skills' && (
                                    <MyProjectSkillsSettings
                                        project={project}
                                    />
                                )}
                                {activeTab === 'my-working-hours' && (
                                    <MyProjectWorkingHoursSettings
                                        project={project}
                                    />
                                )}
                            </div>
                        </div>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
